import json
import logging
import sys
from typing import Any

_SKIP_ATTRS = frozenset({
    "name", "msg", "args", "created", "filename", "funcName",
    "levelname", "levelno", "lineno", "module", "msecs", "pathname",
    "process", "processName", "relativeCreated", "thread", "threadName",
    "exc_info", "exc_text", "stack_info", "message", "taskName",
})


class _JsonFormatter(logging.Formatter):
    """JSON lines compatible with Cloud Logging structured logging.

    Cloud Logging recognises: severity, message, httpRequest, and
    logging.googleapis.com/trace as special top-level fields.
    Everything else lands in jsonPayload and is searchable.
    """
    _SEVERITY = {
        logging.DEBUG: "DEBUG",
        logging.INFO: "INFO",
        logging.WARNING: "WARNING",
        logging.ERROR: "ERROR",
        logging.CRITICAL: "CRITICAL",
    }

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "severity": self._SEVERITY.get(record.levelno, "DEFAULT"),
            "message": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        for key, val in vars(record).items():
            if key not in _SKIP_ATTRS and not key.startswith("_"):
                entry[key] = val
        return json.dumps(entry, default=str)


def configure_logging(environment: str, debug: bool) -> None:
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if debug else logging.INFO)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    if environment == "production":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)-8s %(name)-40s %(message)s",
            datefmt="%H:%M:%S",
        ))
    root.addHandler(handler)

    # Silence noisy third-party loggers
    for name in ("httpx", "httpcore", "uvicorn.access", "python_multipart"):
        logging.getLogger(name).setLevel(logging.WARNING)
