import unittest
from vision_worker.test_server import app
from vision_worker.reference import config
from vision_worker.reference.wrongway.roi import ROIManager
from vision_worker.reference.wrongway.detector import WrongWayDetector, VehicleState
from vision_worker.reference.wrongway.trajectory import TrajectoryStore


class HarnessTests(unittest.TestCase):
    def test_settings_and_no_hardware(self):
        client = app.test_client()
        for body in ({'direction': 'up'}, {'mode': 'scenario'}, {'direction': []}):
            self.assertEqual(client.post('/settings', json=body).status_code, 400)
        for direction in ('normal', 'reverse'):
            self.assertEqual(client.post('/settings', json={'direction': direction}).status_code, 200)
            self.assertEqual(client.get('/state').json['frame'], 0)
        self.assertFalse(client.get('/health').json['physical_control'])

    def test_reversing_reference_changes_detection(self):
        for reverse in (False, True):
            roi = ROIManager(config.SC10_ROIS, reverse_direction=reverse).rois[0]
            detector = WrongWayDetector(-.45, 10)
            for _ in range(10):
                result = detector.update(1, (20, 2), roi)
            expected = VehicleState.WRONG_WAY if reverse else VehicleState.NORMAL
            self.assertEqual(result.state, expected)
            self.assertEqual(result.event_started, reverse)
            self.assertFalse(detector.update(1, (20, 2), roi).event_started)

    def test_roi_and_trajectory(self):
        manager = ROIManager(config.SC10_ROIS)
        self.assertIsNone(manager.find((0, 0)))
        self.assertEqual(manager.find((500, 315)).name, 'West_Approach')
        trajectory = TrajectoryStore(20)
        trajectory.add(1, (100, 100))
        self.assertIsNone(trajectory.movement_vector(1, 15, 8))
        trajectory.add(1, (120, 102))
        self.assertEqual(trajectory.movement_vector(1, 15, 8), (20, 2))
