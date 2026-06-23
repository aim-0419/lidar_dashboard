const mockLidarService = require("./mockLidar.service");

function getState(req, res) {
  res.json(mockLidarService.getState());
}

function getControlStatus(req, res) {
  // 현장 점검자가 차단기/VMS/라이다 표시 상태만 빠르게 확인할 수 있게 service 결과를 그대로 반환한다.
  res.json(mockLidarService.getControlStatus());
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
  getControlStatus,
  getLogs,
  openGate,
  closeGate,
  setVms,
  passVehicle,
};
