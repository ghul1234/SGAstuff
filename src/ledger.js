export const TAXONOMY = [
  'Infrastructure',
  'Education',
  'Healthcare',
  'Technology',
  'Environmental',
  'Defense',
  'Economic Relief',
  'Social Services'
];

export class SGALedger {
  constructor() {
    this.chain = [];
  }

  async init() {
    const stored = localStorage.getItem('sga_ledger_chain');
    if (stored) {
      this.chain = JSON.parse(stored);
    } else {
      // Genesis block
      const genesisRecord = {
        id: '0',
        timestamp: new Date().toISOString(),
        category: 'System',
        amount: 0,
        agency: 'System Admin',
        region: 'US',
        description: 'Genesis Block'
      };
      
      const hash = await this.calculateHash(genesisRecord, '0');
      
      this.chain.push({
        record: genesisRecord,
        previousHash: '0',
        hash: hash
      });
      this.save();
    }
  }

  async calculateHash(record, previousHash) {
    const dataString = JSON.stringify(record) + previousHash;
    const msgBuffer = new TextEncoder().encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async addRecord(recordData) {
    const previousBlock = this.chain[this.chain.length - 1];
    
    const newRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...recordData
    };

    const hash = await this.calculateHash(newRecord, previousBlock.hash);

    const newBlock = {
      record: newRecord,
      previousHash: previousBlock.hash,
      hash: hash
    };

    this.chain.push(newBlock);
    this.save();
    return newBlock;
  }

  save() {
    localStorage.setItem('sga_ledger_chain', JSON.stringify(this.chain));
  }

  async clearAll() {
    this.chain = [];
    localStorage.removeItem('sga_ledger_chain');
    await this.init();
  }

  async verifyIntegrity() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }

      const calculatedHash = await this.calculateHash(currentBlock.record, currentBlock.previousHash);
      if (currentBlock.hash !== calculatedHash) {
        return false;
      }
    }
    return true;
  }

  getRecords(filters = {}) {
    let records = this.chain.filter(block => block.record.id !== '0').map(block => ({
      ...block.record,
      hash: block.hash
    }));

    if (filters.category && filters.category !== 'All') {
      records = records.filter(r => r.category === filters.category);
    }
    if (filters.agency) {
      records = records.filter(r => r.agency.toLowerCase().includes(filters.agency.toLowerCase()));
    }
    if (filters.region && filters.region !== 'All') {
      records = records.filter(r => r.region === filters.region);
    }
    if (filters.startDate) {
      records = records.filter(r => new Date(r.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1); // include the whole day
      records = records.filter(r => new Date(r.timestamp) <= endDate);
    }

    return records.reverse(); // Reverse chronological
  }
}
