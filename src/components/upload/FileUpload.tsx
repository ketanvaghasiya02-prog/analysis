/**
 * Multi-CSV upload control with drag-and-drop and file-picker support.
 */

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useData } from '@/context/DataContext';
import { UploadIcon } from '@/components/common/icons';

interface FileUploadProps {
  /** Compact variant for the sidebar vs. large variant for the empty state. */
  variant?: 'compact' | 'hero';
}

function isCsv(file: File): boolean {
  return (
    file.type === 'text/csv' ||
    file.name.toLowerCase().endsWith('.csv') ||
    file.type === 'application/vnd.ms-excel'
  );
}

export function FileUpload({ variant = 'compact' }: FileUploadProps) {
  const { addFiles, isParsing } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const all = Array.from(fileList);
      const csvs = all.filter(isCsv);
      const bad = all.filter((f) => !isCsv(f)).map((f) => f.name);
      setRejected(bad);
      if (csvs.length > 0) void addFiles(csvs);
    },
    [addFiles],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDrag = useCallback((e: DragEvent<HTMLDivElement>, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  }, []);

  const hero = variant === 'hero';

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragEnter={(e) => onDrag(e, true)}
        onDragOver={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDrop={onDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors',
          dragActive
            ? 'border-accent bg-accent/10'
            : 'border-panel-border bg-panel-raised hover:border-accent/50',
          hero ? 'px-8 py-12' : 'px-4 py-6',
        ].join(' ')}
      >
        <UploadIcon
          className={[hero ? 'text-4xl' : 'text-2xl', 'text-accent'].join(' ')}
        />
        <p
          className={[
            'mt-3 font-medium text-ink',
            hero ? 'text-base' : 'text-sm',
          ].join(' ')}
        >
          {isParsing ? 'Parsing…' : 'Drop CSV files or click to browse'}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Supports multiple GapMonitor CSV files at once
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {rejected.length > 0 && (
        <p className="mt-2 text-xs text-warning">
          Ignored {rejected.length} non-CSV file
          {rejected.length > 1 ? 's' : ''}: {rejected.join(', ')}
        </p>
      )}
    </div>
  );
}
