import tempfile
import unittest
from unittest.mock import patch
from vision_worker.camera_sources import CameraSources
from vision_worker import test_server


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.sources = CameraSources(self.folder.name)

    def test_save_reload_and_no_secret_in_response(self):
        self.sources.save('camera-6', {'mode':'rtsp', 'url':'rtsp://user:secret@192.168.0.10/live'})
        reloaded = CameraSources(self.folder.name)
        self.assertEqual(reloaded.public('camera-6'), {'mode':'rtsp','configured':True})
        self.assertEqual(reloaded.public('camera-1'), {'mode':'test','configured':False})
        self.sources.save('camera-6', {'mode':'test'})
        self.assertIn('secret', self.sources.load('camera-6')['url'])

    def test_validation_preserves_previous(self):
        for body in ({'mode':'rtsp'}, {'mode':'rtsp','url':'file:///etc/passwd'},
                     {'mode':'rtsp','url':'http://localhost'}, {'mode':'rtsp','url':'rtsp://host:bad/live'}):
            with self.assertRaises(ValueError):
                self.sources.save('camera-1', body)
        self.assertEqual(self.sources.public('camera-1')['mode'], 'test')

    def test_api(self):
        with patch.object(test_server, 'sources', self.sources):
            client = test_server.app.test_client()
            result = client.put('/cameras/camera-6/source', json={'mode':'rtsp','url':'rtsp://u:secret@192.168.1.20/live'})
            self.assertEqual(result.status_code, 200)
            self.assertNotIn('secret', result.text)
            self.assertNotIn('secret', client.get('/cameras/camera-6/source').text)
            self.assertEqual(client.get('/cameras/camera-7/source').status_code, 404)
