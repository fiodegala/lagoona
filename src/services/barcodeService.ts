// Barcode input handling service
// Supports USB barcode scanners (keyboard mode) and manual input

interface BarcodeConfig {
  minLength: number;
  maxLength: number;
  timeout: number; // ms to wait for complete barcode
  prefix?: string;
  suffix?: string;
}

const DEFAULT_CONFIG: BarcodeConfig = {
  minLength: 8,
  maxLength: 20,
  timeout: 100,
  suffix: 'Enter',
};

export interface BarcodeResult {
  code: string;
  timestamp: number;
  source: 'scanner' | 'manual';
}

type BarcodeCallback = (result: BarcodeResult) => void;

class BarcodeService {
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private config: BarcodeConfig = DEFAULT_CONFIG;
  private callbacks: Set<BarcodeCallback> = new Set();
  private isListening: boolean = false;
  private boundHandleKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
  }

  configure(config: Partial<BarcodeConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  startListening(): void {
    if (this.isListening) return;
    
    document.addEventListener('keydown', this.boundHandleKeyDown);
    this.isListening = true;
  }

  stopListening(): void {
    if (!this.isListening) return;
    
    document.removeEventListener('keydown', this.boundHandleKeyDown);
    this.isListening = false;
    this.clearBuffer();
  }

  subscribe(callback: BarcodeCallback): () => void {
    this.callbacks.add(callback);
    
    // Start listening if not already
    if (this.callbacks.size === 1) {
      this.startListening();
    }

    return () => {
      this.callbacks.delete(callback);
      
      // Stop listening if no more subscribers
      if (this.callbacks.size === 0) {
        this.stopListening();
      }
    };
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore if typing in an input field (but allow search input)
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Only process if it's specifically marked for barcode scanning
      if (!target.hasAttribute('data-barcode-input')) {
        return;
      }
    }

    const now = Date.now();
    
    // Check if this is a new barcode scan (time gap too long)
    if (now - this.lastKeyTime > this.config.timeout && this.buffer.length > 0) {
      this.clearBuffer();
    }
    
    this.lastKeyTime = now;

    // Handle Enter key (end of barcode)
    if (e.key === 'Enter' || e.key === this.config.suffix) {
      if (this.buffer.length >= this.config.minLength) {
        this.processBarcode();
      }
      this.clearBuffer();
      return;
    }

    // Only accept printable characters
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      this.buffer += e.key;
      
      // Clear timeout and set new one
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      
      this.timeoutId = setTimeout(() => {
        // If buffer is long enough when timeout occurs, process it
        if (this.buffer.length >= this.config.minLength) {
          this.processBarcode();
        }
        this.clearBuffer();
      }, this.config.timeout);
    }
  }

  private processBarcode(): void {
    let code = this.buffer.trim();
    
    // Remove prefix if present
    if (this.config.prefix && code.startsWith(this.config.prefix)) {
      code = code.slice(this.config.prefix.length);
    }
    
    // Validate length
    if (code.length < this.config.minLength || code.length > this.config.maxLength) {
      return;
    }

    const result: BarcodeResult = {
      code,
      timestamp: Date.now(),
      source: 'scanner',
    };

    // Notify all subscribers
    this.callbacks.forEach((callback) => {
      try {
        callback(result);
      } catch (error) {
        console.error('Barcode callback error:', error);
      }
    });
  }

  private clearBuffer(): void {
    this.buffer = '';
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // Manual barcode input
  processManualInput(code: string): void {
    const trimmedCode = code.trim();
    
    if (trimmedCode.length < this.config.minLength) {
      return;
    }

    const result: BarcodeResult = {
      code: trimmedCode,
      timestamp: Date.now(),
      source: 'manual',
    };

    this.callbacks.forEach((callback) => {
      try {
        callback(result);
      } catch (error) {
        console.error('Barcode callback error:', error);
      }
    });
  }

  // Validate barcode format
  isValidBarcode(code: string): boolean {
    const trimmed = code.trim();
    return (
      trimmed.length >= this.config.minLength &&
      trimmed.length <= this.config.maxLength &&
      /^[a-zA-Z0-9-]+$/.test(trimmed)
    );
  }

  // EAN-13 checksum validation
  isValidEAN13(code: string): boolean {
    if (code.length !== 13 || !/^\d+$/.test(code)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[12]);
  }

  // EAN-8 checksum validation
  isValidEAN8(code: string): boolean {
    if (code.length !== 8 || !/^\d+$/.test(code)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(code[7]);
  }
}

export const barcodeService = new BarcodeService();
