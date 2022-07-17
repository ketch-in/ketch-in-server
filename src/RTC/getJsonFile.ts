import * as fs from "fs";

export default function getJsonFile(path: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(path).toString());
  } catch (e) {
    return {};
  }
}
