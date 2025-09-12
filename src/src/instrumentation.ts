import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { registerOTel } from "@vercel/otel";

const OTEL_LOGS_URL = process.env.OTEL_EXPORTER_OTLP_ENDPOINT + "/v1/logs";

const exporter = new OTLPLogExporter({ url: OTEL_LOGS_URL });
const processor = new BatchLogRecordProcessor(exporter);
const loggerProvider = new LoggerProvider();

loggerProvider.addLogRecordProcessor(processor);
export const logger = loggerProvider.getLogger("next-otel-logger");

export function register() {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  logger.emit({
    body: "init",
    severityText: "INFO",
    attributes: { foo: "bar" },
  });

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "next-app",
    logRecordProcessor: processor,
  });
}
