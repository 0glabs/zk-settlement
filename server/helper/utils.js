const fs = require('fs').promises;
const path = require('path');

/**
 * Converts a Uint8Array to a formatted string representation.
 * @param {Uint8Array} bytes - The byte array to format.
 * @returns {string} - The formatted string representation.
 */
function formatBytes(bytes) {
    return '[' + Array.from(bytes).map(b => `"${b}"`).join(', ') + ']';
}

/**
 * Parses a formatted string representation of a byte array back to a Uint8Array.
 * @param {string} str - The string representation to parse.
 * @returns {Uint8Array} - The resulting byte array.
 */
function parseBytes(str) {
    const arr = JSON.parse(str);
    return new Uint8Array(arr.map(s => parseInt(s)));
}

/**
 * Converts a byte array to a BigInt.
 * @param {Uint8Array} x - The byte array to convert.
 * @returns {BigInt} - The resulting BigInt.
 */
function arrayToBigint(x) {
    return x.reduce((acc, byte) => (acc << 8n) + BigInt(byte), 0n);
}

/**
 * Converts a BigInt to a byte array.
 * @param {number} n - The bit length of each element in the array.
 * @param {number} k - The number of elements in the array.
 * @param {BigInt} x - The BigInt to convert.
 * @returns {Array<BigInt>} - The resulting array of BigInt.
 */
function bigintToArray(n, k, x) {
    const mod = 1n << BigInt(n);
    const ret = [];

    for (let idx = 0; idx < k; idx++) {
        ret.push(x % mod);
        x = x / mod;
    }

    return ret;
}

function bigintToBytes(bigint, length) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = Number((bigint >> BigInt(8 * i)) & BigInt(0xff)); // 调整字节顺序
    }
    return bytes;
}

function bytesToBigint(bytes) {
    let bigint = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
        bigint += BigInt(bytes[i]) << BigInt(8 * i);
    }
    return bigint;
}

function convertToBiguint64(timestamp) {
    const bytes = new ArrayBuffer(8);
    const view = new DataView(bytes);
    view.setBigUint64(0, BigInt(timestamp), true); // 8字节，无符号整型，小端序
    return view.getBigUint64(0, true);
}

function formatArray(arr) {
    return `[${arr.join(', ')}]`;
}

function jsonifyData(data, useBigInt = false) {
    function transform(item) {
        if (item instanceof Uint8Array) {
            if (useBigInt) {
                // 将 Uint8Array 的每个元素转换为 BigInt 字符串
                return Array.from(item, byte => BigInt(byte).toString());
            } else {
                // 直接转换为普通数组
                return Array.from(item);
            }
        } else if (Array.isArray(item)) {
            return item.map(transform);
        } else if (typeof item === 'object' && item !== null) {
            return Object.fromEntries(
                Object.entries(item).map(([key, value]) => [key, transform(value)])
            );
        }
        return item;
    }

    return JSON.stringify(transform(data));
}

async function writeJsonToFile(data, filename) {
    const jsonData = jsonifyData(data);
    const filePath = path.join(__dirname, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, jsonData);
    return filePath;
}

module.exports = {
    formatBytes,
    parseBytes,
    arrayToBigint,
    bigintToArray,
    bigintToBytes,
    bytesToBigint,
    convertToBiguint64,
    formatArray,
    jsonifyData,
    writeJsonToFile
};
