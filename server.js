const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, 'data', 'finance.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Read data
function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading data:', e.message);
  }
  return { income: [], expense: [], budgets: [], scenarios: [] };
}

// Write data
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ==================== API Routes ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// Get all data
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// Get summary
app.get('/api/summary', (req, res) => {
  const data = readData();
  const totalIncome = data.income.reduce((s, e) => s + e.amount, 0);
  const totalExpense = data.expense.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? (netProfit / totalIncome * 100) : 0;

  // Category breakdown
  const incomeByCat = {};
  data.income.forEach(e => { incomeByCat[e.category] = (incomeByCat[e.category] || 0) + e.amount; });
  const expenseByCat = {};
  data.expense.forEach(e => { expenseByCat[e.category] = (expenseByCat[e.category] || 0) + e.amount; });

  res.json({
    totalIncome,
    totalExpense,
    netProfit,
    margin: parseFloat(margin.toFixed(2)),
    incomeCount: data.income.length,
    expenseCount: data.expense.length,
    incomeByCat,
    expenseByCat,
  });
});

// Add income
app.post('/api/income', (req, res) => {
  const { desc, amount, category, date } = req.body;
  if (!desc || !amount || amount <= 0 || !category) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  const data = readData();
  const entry = {
    id: Date.now(),
    desc: desc.trim(),
    amount: parseFloat(amount),
    category: category.trim(),
    date: date || new Date().toISOString().split('T')[0],
  };
  data.income.push(entry);
  writeData(data);
  res.json({ success: true, entry });
});

// Add expense
app.post('/api/expense', (req, res) => {
  const { desc, amount, category, date } = req.body;
  if (!desc || !amount || amount <= 0 || !category) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  const data = readData();
  const entry = {
    id: Date.now(),
    desc: desc.trim(),
    amount: parseFloat(amount),
    category: category.trim(),
    date: date || new Date().toISOString().split('T')[0],
  };
  data.expense.push(entry);
  writeData(data);
  res.json({ success: true, entry });
});

// Delete entry
app.delete('/api/entry/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const data = readData();
  if (type === 'income') {
    data.income = data.income.filter(e => e.id !== parseInt(id));
  } else if (type === 'expense') {
    data.expense = data.expense.filter(e => e.id !== parseInt(id));
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }
  writeData(data);
  res.json({ success: true });
});

// Break-even analysis
app.post('/api/breakeven', (req, res) => {
  const { fixedCost, price, variableCost, targetProfit } = req.body;
  const fc = parseFloat(fixedCost) || 0;
  const p = parseFloat(price) || 0;
  const vc = parseFloat(variableCost) || 0;
  const tp = parseFloat(targetProfit) || 0;

  const cm = p - vc;
  const beUnits = cm > 0 ? Math.ceil(fc / cm) : Infinity;
  const beRevenue = cm > 0 ? beUnits * p : Infinity;
  const cmRatio = p > 0 ? (cm / p * 100) : 0;
  const targetUnits = cm > 0 ? Math.ceil((fc + tp) / cm) : Infinity;
  const targetRevenue = cm > 0 ? targetUnits * p : Infinity;

  res.json({
    contributionMargin: parseFloat(cm.toFixed(2)),
    contributionMarginRatio: parseFloat(cmRatio.toFixed(2)),
    breakEvenUnits: beUnits,
    breakEvenRevenue: parseFloat(beRevenue.toFixed(2)),
    targetUnits,
    targetRevenue: parseFloat(targetRevenue.toFixed(2)),
  });
});

// Budgets
app.get('/api/budgets', (req, res) => {
  const data = readData();
  res.json(data.budgets || []);
});

app.post('/api/budgets', (req, res) => {
  const { category, amount, month } = req.body;
  if (!category || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  const data = readData();
  const budget = {
    id: Date.now(),
    category: category.trim(),
    amount: parseFloat(amount),
    month: month || new Date().toISOString().substring(0, 7),
  };
  if (!data.budgets) data.budgets = [];
  data.budgets.push(budget);
  writeData(data);
  res.json({ success: true, budget });
});

app.delete('/api/budgets/:id', (req, res) => {
  const data = readData();
  if (!data.budgets) data.budgets = [];
  data.budgets = data.budgets.filter(b => b.id !== parseInt(req.params.id));
  writeData(data);
  res.json({ success: true });
});

// Reset
app.post('/api/reset', (req, res) => {
  writeData({ income: [], expense: [], budgets: [], scenarios: [] });
  res.json({ success: true });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`💰 利润成本计算分析系统 服务已启动`);
  console.log(`📊 访问地址: http://localhost:${PORT}`);
  console.log(`📡 API 地址: http://localhost:${PORT}/api/health`);
});
