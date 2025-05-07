import path from "path";
import { readdirSync, readFileSync } from "fs";

function readFilesFromDir(dirPath: string) {
  const dir = path.join(process.cwd(), dirPath);
  const files = readdirSync(dir);

  return files.map((file) => {
    const filePath = path.join(dir, file);

    return {
      name: file,
      content: readFileSync(filePath, "utf-8"),
    };
  });
}

export function getEndpoints() {
  return readFilesFromDir("tinybird/endpoints");
}

export function getDatasources() {
  return readFilesFromDir("tinybird/datasources").map((datasource) => {
    return {
      name: datasource.name.replace(".datasource", ""),
      content: datasource.content,
    };
  });
}

export function getEndpointQuestions() {
  const endpoint = getEndpoints();

  return endpoint.map((endpoint) => {
    const description = endpoint.content
      .split("DESCRIPTION >")[1]
      .split("NODE")[0]
      .trim();

    return {
      name: endpoint.name,
      content: endpoint.content,
      question: description,
    };
  });
}

export function getEndpointQuestion(name: string) {
  const endpoint = getEndpointQuestions().find((endpoint) => endpoint.name === name);
  if (!endpoint) {
    throw new Error(`Endpoint ${name} not found`);
  }

  return endpoint;
}

