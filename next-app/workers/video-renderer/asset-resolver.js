const fs = require("node:fs/promises");
const path = require("node:path");

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ASSET_DOWNLOAD_${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, buffer);
  return destination;
}

async function resolveRemoteAssets(assets, dir) {
  const resolved=[];
  for (let i=0;i<assets.length;i++) {
    const a=assets[i];
    if (!a?.url) throw new Error("ASSET_URL_MISSING");
    const ext=(a.mimeType||"").includes("png")?".png":(a.mimeType||"").includes("webp")?".webp":".bin";
    const target=path.join(dir,`asset-${i}${ext}`);
    resolved.push({...a,localPath:await download(a.url,target)});
  }
  return resolved;
}

module.exports={resolveRemoteAssets};
