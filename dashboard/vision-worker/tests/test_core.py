import unittest
from vision_worker.core import Gate, Observation, ZoneController


class Tests(unittest.TestCase):
    def setUp(self):
        self.c = ZoneController((1, 0))

    def step(self, time, x=None, **kwargs):
        obs = [] if x is None else [Observation("a", (x, 0))]
        return self.c.step(time, obs, healthy=True, **kwargs)

    def trigger(self):
        self.step(1, 100)
        self.step(2, 90)
        return self.step(3, 80, gate=Gate.OPEN)

    def test_confirm_and_no_duplicate_command(self):
        self.assertEqual(self.trigger()[0].action, "close")
        self.assertEqual(self.step(4, 70), [])

    def test_lost_hazard_never_opens(self):
        self.trigger()
        for time in range(4, 20):
            self.assertEqual(self.step(time, gate=Gate.CLOSED, safety_clear=True), [])
        self.assertTrue(self.c.tracks["a"].hazardous)

    def test_confirmed_exit_requires_safety_and_delay(self):
        self.trigger()
        self.step(4, gate=Gate.CLOSED, exited=["a"])
        self.assertEqual(self.step(5, gate=Gate.CLOSED), [])
        self.assertEqual(self.step(6, gate=Gate.CLOSED, safety_clear=True), [])
        self.assertEqual(self.step(9, gate=Gate.CLOSED, safety_clear=True)[0].action, "open")

    def test_other_hazard_blocks_release(self):
        self.trigger()
        self.c.tracks["b"] = self.c.tracks["a"]
        self.step(4, gate=Gate.CLOSED, exited=["a"], safety_clear=True)
        self.assertEqual(self.step(10, gate=Gate.CLOSED, safety_clear=True), [])

    def test_repeated_frame_rejected(self):
        self.step(1, 100)
        with self.assertRaises(ValueError):
            self.step(1, 80)

    def test_disconnect_cannot_open(self):
        self.trigger()
        self.assertEqual(self.c.step(4, [], healthy=False, gate=Gate.CLOSED, safety_clear=True), [])

    def test_command_timeout_latches_fault(self):
        self.trigger()
        self.step(9)
        self.assertTrue(self.c.command_fault)


if __name__ == "__main__":
    unittest.main()
