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
      
      this.chain.push({
        record: genesisRecord
      });
      this.save();
    }
  }

  async addRecord(recordData) {
    const newRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...recordData
    };

    const newBlock = {
      record: newRecord
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

  updateRecord(id, patch) {
    const block = this.chain.find(b => b.record.id === id);
    if (block) {
      block.record = { ...block.record, ...patch };
      this.save();
      return block.record;
    }
    return null;
  }

  getRecords(filters = {}) {
    let records = this.chain.filter(block => block.record.id !== '0').map(block => ({
      ...block.record
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
