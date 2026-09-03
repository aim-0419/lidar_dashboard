const MIN_PASSWORD_LENGTH = 8;

function isValidPassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

function normalizePhoneNumber(phoneNumber) {
  const value = String(phoneNumber || "").trim();
  const digits = value.replace(/\D/g, "");

  return value.startsWith("+") ? `+${digits}` : digits;
}

function isValidPhoneNumber(phoneNumber) {
  return /^\+?[1-9]\d{7,14}$/.test(phoneNumber);
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  isValidPassword,
  normalizePhoneNumber,
  isValidPhoneNumber,
};
