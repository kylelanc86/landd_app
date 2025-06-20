const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function checkProjects() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const indexes = await db.collection('projects').indexes();
    
    console.log('PROJECTS indexes:');
    indexes.forEach((index, i) => {
      const indexName = index.name || 'unnamed';
      const indexKeys = Object.entries(index.key).map(([key, value]) => `${key}:${value}`).join(', ');
      console.log(`${i + 1}. ${indexName}: { ${indexKeys} }`);
    });
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkProjects(); 