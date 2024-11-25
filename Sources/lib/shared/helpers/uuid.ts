const supportsPRNG = typeof self.crypto !== "undefined" && typeof self.crypto.getRandomValues !== "undefined";

export default function uuid(): string {
  // This isn't gonna be the best implementation ever, but it will do well
  // And it's code I fully made myself (hi, I'm arnaud), so there's no license attached to it

  // Designed according to
  // http://codingrepo.com/regular-expression/2015/11/23/javascript-generate-uuidguid-for-rfc-4122-version-4-compliant-with-regular-expression/

  // We need 31 random ints. Other are dashes and the magic 4
  const randomNumbers: number[] = new Array(31);

  // Populate the random numbers
  if (supportsPRNG) {
    const prngRandomBytes = new Uint8Array(randomNumbers.length);
    self.crypto.getRandomValues(prngRandomBytes);
    for (let i = 0; i < randomNumbers.length; i += 1) {
      randomNumbers[i] = prngRandomBytes[i] % 16 | 0;
    }
  } else {
    for (let i = 0; i < randomNumbers.length; i += 1) {
      randomNumbers[i] = (Math.random() * 16) | 0;
    }
  }

  // The 16th number needs to be ‘8’, ‘9’, ‘A’, or ‘B’. We can bitmask that.

  randomNumbers[15] = (randomNumbers[15] & 0x3) | 0x8;

  let uuidString = "";
  // Generate the uuid string. Don't forget to add the - and 4 at the right positions
  for (let i = 0; i < randomNumbers.length; i += 1) {
    uuidString += randomNumbers[i].toString(16);

    if (i === 7 || i === 14 || i === 18) {
      uuidString += "-";
    } else if (i === 11) {
      uuidString += "-4";
    }
  }

  return uuidString;
}
