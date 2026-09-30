import copy
import tempfile
import unittest
from unittest.mock import patch
from vision_worker.roi_store import RoiStore, validate
from vision_worker import test_server


class RoiTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.store = RoiStore(self.folder.name)
        self.body = {"rois": [{"name": "lane", "polygon": [[.1,.1],[.8,.1],[.8,.8],[.1,.8]], "direction": [.15,0]}]}

    def test_camera_isolation_and_reload(self):
        self.store.save('camera-1', self.body)
        self.assertEqual(RoiStore(self.folder.name).load('camera-1'), self.body)
        for i in range(2,7):
            self.assertEqual(self.store.load(f'camera-{i}'), {"rois":[]})
        self.store.save('camera-2', {"rois":[]})
        self.assertEqual(self.store.load('camera-1'), self.body)
        with self.assertRaises(ValueError):
            self.store.load('../outside')

    def test_invalid_geometry_does_not_replace(self):
        self.store.save('camera-1', self.body)
        for polygon in ([[0,0],[1,1],[0,1],[1,0]], [[0,0],[.5,.5],[1,1]], [[0,0],[2,0],[1,1]]):
            bad = copy.deepcopy(self.body)
            bad['rois'][0]['polygon'] = polygon
            with self.assertRaises(ValueError):
                self.store.save('camera-1', bad)
            self.assertEqual(self.store.load('camera-1'), self.body)
        for direction in ([0,0], [float('nan'),0], [True,0]):
            bad = copy.deepcopy(self.body)
            bad['rois'][0]['direction'] = direction
            with self.assertRaises(ValueError):
                validate(bad)

    def test_api(self):
        with patch.object(test_server, 'store', self.store):
            client = test_server.app.test_client()
            reference = client.get('/reference-rois').json
            validate(reference)
            self.assertEqual(client.put('/cameras/camera-1/rois', json=reference).status_code, 200)
            self.assertEqual(client.get('/cameras/camera-1/rois').json, reference)
            self.assertEqual(client.get('/cameras/camera-6/rois').json, {"rois":[]})
            self.assertEqual(client.get('/cameras/camera-7/rois').status_code, 404)
            self.assertEqual(client.put('/cameras/camera-1/rois', json={}).status_code, 400)
