// An IPv6 host usually controls a whole /64, so one caller is its /64 rather
// than each of its addresses. An IPv4-mapped address is its IPv4 address.
const ipv6Prefix64 = (ip) => {
  const halves = ip.split('::');
  if (halves.length > 2) return '';
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return '';
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return '';
  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`;
};

export const normalizeCallerIp = (ip) => {
  const mappedIpv4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4) return mappedIpv4[1];
  return ip.includes(':') ? ipv6Prefix64(ip) || ip : ip;
};

