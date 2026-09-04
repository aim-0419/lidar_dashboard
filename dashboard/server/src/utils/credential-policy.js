const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 UTF-8 bytes of a password.
const MAX_PASSWORD_BYTES = 72;
const MIN_USER_ID_LENGTH = 4;
const MAX_USER_ID_LENGTH = 30;
const USER_ID_PATTERN = new RegExp(`^[A-Za-z0-9]{${MIN_USER_ID_LENGTH},${MAX_USER_ID_LENGTH}}$`);

function getPasswordValidationError(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return "TOO_SHORT";
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return "TOO_LONG";
  }

  return null;
}

function isValidPassword(password) {
  return getPasswordValidationError(password) === null;
}

function isValidUserId(userId) {
  return typeof userId === "string" && USER_ID_PATTERN.test(userId.trim());
}

function normalizePhoneNumber(phoneNumber) {
  const value = String(phoneNumber || "").trim();
  const digits = value.replace(/\D/g, "");

  return value.startsWith("+") ? `+${digits}` : digits;
}

function isValidPhoneNumber(phoneNumber) {
  // 국내 휴대전화 번호와 국제 형식 번호를 모두 허용한다.
  return /^(?:01[016789]\d{7,8}|\+?[1-9]\d{7,14})$/.test(phoneNumber);
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  MIN_USER_ID_LENGTH,
  MAX_USER_ID_LENGTH,
  getPasswordValidationError,
  isValidPassword,
  isValidUserId,
  normalizePhoneNumber,
  isValidPhoneNumber,
};
