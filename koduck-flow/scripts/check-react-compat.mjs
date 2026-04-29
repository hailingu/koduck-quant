import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8")
);

const reactPeer = packageJson.peerDependencies?.react;
const reactDomPeer = packageJson.peerDependencies?.["react-dom"];
const reactDev = packageJson.devDependencies?.react;
const reactDomDev = packageJson.devDependencies?.["react-dom"];

const errors = [];

if (reactPeer !== ">=19 <20") {
  errors.push(`react peerDependency must stay ">=19 <20"; found ${reactPeer ?? "<missing>"}`);
}

if (reactDomPeer !== ">=19 <20") {
  errors.push(
    `react-dom peerDependency must stay ">=19 <20"; found ${reactDomPeer ?? "<missing>"}`
  );
}

for (const [name, version] of [
  ["react", reactDev],
  ["react-dom", reactDomDev],
]) {
  const normalized = typeof version === "string" ? version.replace(/^[~^]/, "") : "";
  const major = Number.parseInt(normalized.split(".")[0] ?? "", 10);

  if (major !== 19) {
    errors.push(`${name} devDependency must exercise React 19; found ${version ?? "<missing>"}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log("React peer range and dev dependency majors are compatible.");
