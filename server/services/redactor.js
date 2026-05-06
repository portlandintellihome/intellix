// AI input guard. Refuses prompts that contain physical-access credentials
// (alarm/garage/door/gate codes), labeled numeric codes/pins, or labeled
// WiFi passwords. Everything else — names, addresses, emails, phones,
// network details — passes through to the model unchanged.
//
// guardPII(text) returns { blocked, blockReason }.
//   blocked === false  → safe to send to Claude
//   blocked === true   → refuse, surface blockReason to the caller

// "code 1234", "pin: 5678", "password = 9012", "passcode #3456"
const CODE_LABELED_RE = /\b(?:code|pin|password|passcode)\s*[:=#-]?\s*[`'"(\[]?\d{4,8}[`'")\]]?\b/i

// "alarm code", "garage code", "door pin", "gate password" — even without
// the digits attached, the labels themselves are sensitive.
const ACCESS_LABEL_RE = /\b(?:alarm|garage|door|gate|access|safe|lock|keypad)\s+(?:code|pin|password|passcode)\b/i

// "wifi password = letmein", "wifi key: hunter2", "wpa2 password ..."
const WIFI_PASS_RE = /\b(?:wifi\s+(?:password|key)|network\s+password|wpa(?:2|3)?\s+password|psk)\s*[:=]/i

export function guardPII(text) {
  if (text == null || text === '') {
    return { blocked: false, blockReason: null }
  }

  if (ACCESS_LABEL_RE.test(text)) {
    return {
      blocked: true,
      blockReason: 'Input references a physical access credential (alarm/garage/door/gate code). AI processing of physical access credentials is not allowed.',
    }
  }
  if (CODE_LABELED_RE.test(text)) {
    return {
      blocked: true,
      blockReason: 'Input appears to contain a numeric access code (4-8 digit value labeled as code, pin, password, or passcode). AI processing of access codes is not allowed.',
    }
  }
  if (WIFI_PASS_RE.test(text)) {
    return {
      blocked: true,
      blockReason: 'Input appears to contain a WiFi password. AI processing of network credentials is not allowed.',
    }
  }

  return { blocked: false, blockReason: null }
}
