export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  error?: string;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: string, data?: any, error?: Error | unknown): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      error: error instanceof Error ? error.stack || error.message : error ? String(error) : undefined,
    };
    return JSON.stringify(entry);
  }

  public debug(message: string, context?: string, data?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('debug', message, context, data));
    }
  }

  public info(message: string, context?: string, data?: any): void {
    console.log(this.formatLog('info', message, context, data));
  }

  public warn(message: string, context?: string, data?: any): void {
    console.warn(this.formatLog('warn', message, context, data));
  }

  public error(message: string, error?: Error | unknown, context?: string, data?: any): void {
    console.error(this.formatLog('error', message, context, data, error));
  }
}

export const logger = new Logger();
export default logger;
