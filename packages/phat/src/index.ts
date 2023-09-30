import "@phala/pink-env";
import { Coders } from "@phala/ethers";

type HexString = `0x${string}`

// eth abi coder
const uintCoder = new Coders.NumberCoder(32, false, "uint256");
const bytesCoder = new Coders.BytesCoder("bytes");
const stringCoder = new Coders.StringCoder("string");

function encodeReply(reply: [number, number, string]): HexString {
  return Coders.encode([uintCoder, uintCoder, stringCoder], reply) as HexString;
}

// Defined in TestLensOracle.sol
const TYPE_RESPONSE = 0;
const TYPE_ERROR = 2;

enum Error {
  BadLensProfileId = "BadLensProfileId",
  FailedToFetchData = "FailedToFetchData",
  FailedToDecode = "FailedToDecode",
  MalformedRequest = "MalformedRequest",
}

function errorToCode(error: Error): number {
  switch (error) {
    case Error.BadLensProfileId:
      return 1;
    case Error.FailedToFetchData:
      return 2;
    case Error.FailedToDecode:
      return 3;
    case Error.MalformedRequest:
      return 4;
    default:
      return 0;
  }
}

function isHexString(str: string): boolean {
  const regex = /^0x[0-9a-f]+$/;
  return regex.test(str.toLowerCase());
}

function stringToHex(str: string): string {
  var hex = "";
  for (var i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16);
  }
  return "0x" + hex;
}

function parseProfileId(hexx: string): string {
  var hex = hexx.toString();
  if (!isHexString(hex)) {
    throw Error.BadLensProfileId;
  }
  hex = hex.slice(2);
  var str = "";
  for (var i = 0; i < hex.length; i += 2) {
    const ch = String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
    str += ch;
  }
  return str;
}

function sendTGMessage(msg: string) {
  const strMsg = JSON.stringify(msg)
  console.log(strMsg.toString())
  console.log(msg.toString())
  const tg_bot_http_endpoint = `https://api.telegram.org/bot6365043287:AAGd0jeyMmv1W7FJ7K_12y_PgpTQ5qFjbXw/sendMessage?chat_id=-1001986190934&text=`;
  let headers = {
    "Content-Type": "application/json",
    "User-Agent": "phat-contract",
  };
  const res3 = pink.httpRequest({
    url: `${tg_bot_http_endpoint}\n${msg}`,
    method: "POST",
    headers,
    returnTextBody: true,
  });
  console.info(res3);
}

function getDrandRandomness(drandHttpEndpoint: string): any {
  let headers = {
    "Content-Type": "application/json",
    "User-Agent": "phat-contract",
  };
  const response = pink.httpRequest({
    url: `${drandHttpEndpoint}chains`,
    method: "GET",
    headers,
    returnTextBody: true,
  });
  console.info(response);
  if (response.statusCode !== 200) {
    console.log(
        `Fail to read Lens api with status code: ${response.statusCode}, error: ${
            response.body
        }}`
    );
    throw Error.FailedToFetchData;
  }
  let respBody = response.body;

  if (typeof respBody !== "string") {
    throw Error.FailedToDecode;
  }
  let hi = JSON.parse(respBody);
  console.log(`${hi}`);
  let chains = [];
  for (let chain of hi) {
    console.log(chain)
    chains.push({
      url: `${drandHttpEndpoint}${chain}/public/latest`,
      method: "GET",
      headers,
      returnTextBody: true,
    });
  }
  let randoms = pink.batchHttpRequest(chains, 10000);
  console.log(randoms)
  let yo = []
  for (let resp of randoms) {
    if (typeof resp.body !== "string") {
      throw Error.FailedToDecode;
    }
    yo.push(JSON.parse(resp.body));
  }
  return yo;
}


//
// Here is what you need to implemented for Phat Function, you can customize your logic with
// JavaScript here.
//
// The function will be called with two parameters:
//
// - request: The raw payload from the contract call `request` (check the `request` function in YourContract.sol).
//            In this example, it's a tuple of two elements: [requestId, greeting]
// - settings: The custom settings you set with the `config_core` function of the Action Offchain Rollup Phat Contract. In
//            this example, it just a simple text of the lens api url prefix.
//
// Your returns value MUST be a hex string, and it will send to your contract directly. Check the `_onMessageReceived` function in
// TestLensApiConsumerContract.sol for more details. We suggest a tuple of three elements: [successOrNotFlag, requestId, data] as
// the return value.
//
export default function main(request: HexString, secrets: string): HexString {
  console.log(`handle req: ${request}`);
  let requestId, decodedGreeting;
  try {
    [requestId, decodedGreeting] = Coders.decode([uintCoder, bytesCoder], request);
    console.log(`handle decodedGreeting: ${decodedGreeting}`);
  } catch (error) {
    console.info("Malformed request received");
    return encodeReply([TYPE_ERROR, 0, "ERROR"]);
  }
  try {
    const respData = getDrandRandomness(secrets);
    let randomness = respData[0].randomness;
    console.log("response:", [TYPE_RESPONSE, requestId, randomness]);
    return encodeReply([TYPE_RESPONSE, requestId, randomness]);
  } catch (error) {
    if (error === Error.FailedToFetchData) {
      throw error;
    } else {
      // otherwise tell client we cannot process it
      console.log("error:", [TYPE_ERROR, requestId, error]);
      return encodeReply([TYPE_ERROR, requestId, "ERROR"]);
    }
  }
}
