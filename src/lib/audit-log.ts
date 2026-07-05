export type AuditEntry = {
  id: string;
  timestamp: string;
  phase: 'voice' | 'transport' | 'system';
  source: 'local' | 'remote' | 'system';
  message: string;
};

export class AuditLogger {
  private entries: AuditEntry[] = [];

  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    this.entries.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
  }

  getEntries() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }
}
