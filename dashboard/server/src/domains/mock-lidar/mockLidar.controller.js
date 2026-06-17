const mockLidarService = require("./mockLidar.service");

function getState(req, res) {
  res.json(mockLidarService.getState());
}

function getLogs(req, res) {
  res.json(mockLidarService.getLogs(10));
}

function openGate(req, res) {
  const gate = mockLidarService.openGate();
  res.json({ ok: true, gate });
}

function closeGate(req, res) {
  const gate = mockLidarService.closeGate();
  res.json({ ok: true, gate });
}

function setVms(req, res) {
  const vmsLast = mockLidarService.setVmsText(req.body?.text);
  res.json({ ok: true, vmsLast });
}

function passVehicle(req, res) {
  const vehiclesPassed = mockLidarService.increaseVehiclePassed();
  res.json({ ok: true, vehiclesPassed });
}

module.exports = {
  getState,
  getLogs,
  openGate,
  closeGate,
  setVms,
  passVehicle,
};