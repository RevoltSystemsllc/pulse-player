import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Deliberately separate from CMS-managed settings: a remote layout cannot opt in.
export class LocationPrivacy {
  private enabled = false;

  constructor(private readonly file: string) {
    try {
      this.enabled = JSON.parse(readFileSync(file, 'utf8')).deviceLocationEnabled === true;
    } catch {
      // Missing, unreadable or malformed consent always means off.
    }
  }

  getEnabled(): boolean { return this.enabled; }

  setEnabled(enabled: boolean): void {
    if (typeof enabled !== 'boolean') throw new Error('Location preference must be a boolean.');
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = this.file + '.tmp';
    writeFileSync(temporary, JSON.stringify({ deviceLocationEnabled: enabled }) + '\n', { mode: 0o600 });
    renameSync(temporary, this.file);
    this.enabled = enabled;
  }
}
