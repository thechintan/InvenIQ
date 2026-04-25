const bcrypt = require('bcryptjs');
const pool = require('./config/db');
require('dotenv').config();

async function seed() {
  const client = await pool.connect();
  console.log('🌱 Starting InvenIQ seed...\n');

  try {
    await client.query('BEGIN');

    // ══════ CLEAN EXISTING DATA ══════
    console.log('🧹 Cleaning existing data...');
    await client.query('DELETE FROM alerts');
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM returns');
    await client.query('DELETE FROM transfers');
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM inventory');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM suppliers');
    await client.query('DELETE FROM warehouses');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM categories');

    // ══════ CATEGORIES ══════
    console.log('📁 Creating categories...');
    const categories = {};
    const catData = [
      ['Electronics', 'Consumer electronics, gadgets, and accessories'],
      ['FMCG', 'Fast-moving consumer goods, household items'],
      ['Apparel', 'Clothing, footwear, and fashion accessories'],
      ['Food & Beverage', 'Packaged food, drinks, and grocery items'],
      ['Pharmaceuticals', 'OTC medicines, health and wellness products'],
      ['Industrial', 'Tools, hardware, construction materials'],
      ['Stationery', 'Office supplies, paper products, writing instruments'],
      ['Home & Kitchen', 'Kitchen appliances, utensils, home decor'],
      ['Personal Care', 'Grooming, hygiene, beauty products'],
      ['Sports & Fitness', 'Sporting goods, fitness equipment']
    ];
    for (const [name, desc] of catData) {
      const r = await client.query('INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING category_id', [name, desc]);
      categories[name] = r.rows[0].category_id;
    }

    // ══════ USERS ══════
    console.log('👥 Creating users...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Admin@123', salt);

    const users = {};
    const userData = [
      ['Raj Sharma', 'admin@inveniq.com', 'admin'],
      ['Priya Patel', 'manager@inveniq.com', 'manager'],
      ['Arun Singh', 'staff@inveniq.com', 'staff'],
      ['Meera Joshi', 'viewer@inveniq.com', 'viewer'],
      ['Vikram Mehta', 'vikram@inveniq.com', 'manager'],
      ['Sneha Reddy', 'sneha@inveniq.com', 'staff'],
      ['Amit Desai', 'amit@inveniq.com', 'staff'],
      ['Kavita Nair', 'kavita@inveniq.com', 'viewer'],
    ];
    for (const [name, email, role] of userData) {
      const r = await client.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING user_id',
        [name, email, hash, role]
      );
      users[name] = r.rows[0].user_id;
    }

    // ══════ WAREHOUSES ══════
    console.log('🏢 Creating warehouses...');
    const warehouses = {};
    const whData = [
      ['Ahmedabad Central Hub', 'Ahmedabad', 'Plot 45, GIDC Industrial Area, Vatva', '380001', 15000],
      ['Surat Distribution Center', 'Surat', '12/A, Diamond Nagar, Varachha Road', '395001', 12000],
      ['Vadodara East Warehouse', 'Vadodara', 'Survey No. 78, Makarpura GIDC', '390001', 8000],
      ['Mumbai Logistics Park', 'Mumbai', 'Bhiwandi Warehouse Complex, NH3', '421302', 20000],
      ['Rajkot Storage Facility', 'Rajkot', 'Aji Industrial Area, Plot 120', '360003', 6000],
    ];
    for (const [name, city, address, pincode, cap] of whData) {
      const r = await client.query(
        'INSERT INTO warehouses (name, city, address, pincode, capacity_sqft, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING warehouse_id',
        [name, city, address, pincode, cap, users['Raj Sharma']]
      );
      warehouses[name] = r.rows[0].warehouse_id;
    }
    const warehouseIds = Object.values(warehouses);

    // ══════ SUPPLIERS ══════
    console.log('🤝 Creating suppliers...');
    const supplierData = [
      ['Reliance Retail Supply Co.', 'Mukesh Ambani Jr.', '9876543210', 'supply@reliance.in', 'Navi Mumbai, Maharashtra'],
      ['Tata Distribution Ltd.', 'Ratan Iyer', '9876543211', 'orders@tatadist.com', 'Pune, Maharashtra'],
      ['Gujarat Electronics Hub', 'Jayesh Patel', '9876543212', 'info@gujelectronics.com', 'Ahmedabad, Gujarat'],
      ['Hindustan Wholesale Traders', 'Ramesh Gupta', '9876543213', 'sales@hwt.in', 'Delhi, NCR'],
      ['Bombay Pharma Distributors', 'Dr. Snehal Desai', '9876543214', 'orders@bombaypharma.com', 'Mumbai, Maharashtra'],
      ['South India Wholesale Corp', 'Kumaran Pillai', '9876543215', 'contact@siwc.in', 'Chennai, Tamil Nadu'],
      ['Ahmedabad FMCG Traders', 'Dinesh Shah', '9876543216', 'dinesh@amdavadtraders.com', 'Ahmedabad, Gujarat'],
      ['Delhi Industrial Materials', 'Suresh Kumar', '9876543217', 'info@dimaterials.com', 'New Delhi, Delhi'],
      ['Rajasthan Apparel House', 'Laxman Singh', '9876543218', 'orders@rajapparel.com', 'Jaipur, Rajasthan'],
      ['Chennai Food Supplies Ltd', 'Venkatesh Raman', '9876543219', 'supply@chennaifood.com', 'Chennai, Tamil Nadu'],
      ['Pune Office Essentials', 'Manish Joshi', '9876543220', 'sales@puneoffice.com', 'Pune, Maharashtra'],
      ['Kolkata General Trading', 'Indrajit Sen', '9876543221', 'contact@kgtrade.com', 'Kolkata, West Bengal'],
      ['Bangalore Tech Distribution', 'Srinivas Rao', '9876543222', 'tech@blrdist.com', 'Bangalore, Karnataka'],
      ['Hyderabad Consumer Goods', 'Azeem Khan', '9876543223', 'sales@hydgoods.com', 'Hyderabad, Telangana'],
      ['Madhya Pradesh Agro Supplies', 'Prakash Tiwari', '9876543224', 'info@mpagro.com', 'Indore, Madhya Pradesh'],
    ];
    for (const [name, contact, phone, email, address] of supplierData) {
      await client.query(
        'INSERT INTO suppliers (name, contact_name, phone, email, address) VALUES ($1,$2,$3,$4,$5)',
        [name, contact, phone, email, address]
      );
    }

    // ══════ PRODUCTS ══════
    console.log('📦 Creating products...');
    const products = {};
    const productData = [
      // Electronics (8 products)
      ['SKU-ELEC-001', 'Samsung Galaxy S24 Ultra',             'Electronics',    'pcs',   74999.00, 'Latest flagship smartphone with AI features, 200MP camera, S Pen', null],
      ['SKU-ELEC-002', 'Apple iPhone 15 Pro',                  'Electronics',    'pcs',  134900.00, 'Titanium design, A17 Pro chip, ProMotion display',                  null],
      ['SKU-ELEC-003', 'Sony WH-1000XM5 Headphones',          'Electronics',    'pcs',   29990.00, 'Industry-leading noise cancellation, 30hr battery',                 null],
      ['SKU-ELEC-004', 'Dell XPS 15 Laptop',                   'Electronics',    'pcs',  149990.00, '15.6" OLED, Intel i9-13900H, 32GB RAM, 1TB SSD',                   null],
      ['SKU-ELEC-005', 'Logitech MX Master 3S Mouse',          'Electronics',    'pcs',    8995.00, 'Ergonomic wireless mouse with MagSpeed wheel',                      null],
      ['SKU-ELEC-006', 'Samsung 55" Crystal 4K Smart TV',      'Electronics',    'pcs',   44990.00, 'Crystal Processor 4K, Smart Hub, AirSlim design',                  null],
      ['SKU-ELEC-007', 'Apple iPad Air M2',                    'Electronics',    'pcs',   69900.00, 'M2 chip, 11-inch Liquid Retina, Apple Pencil Pro support',          null],
      ['SKU-ELEC-008', 'JBL Flip 6 Portable Speaker',         'Electronics',    'pcs',   11999.00, 'IP67 waterproof, 12hr playtime, PartyBoost',                        null],
      // FMCG (7 products)
      ['SKU-FMCG-001', 'Surf Excel Matic Front Load 4kg',      'FMCG',           'pcs',     799.00, 'Advanced stain removal formula for front load machines',            null],
      ['SKU-FMCG-002', 'Colgate MaxFresh Toothpaste 300g',     'FMCG',           'pcs',     215.00, 'Cooling crystals with breath strips',                               null],
      ['SKU-FMCG-003', 'Dettol Liquid Handwash 900ml Refill',  'FMCG',           'pcs',     169.00, 'pH balanced, kills 99.9% germs, original formula',                 null],
      ['SKU-FMCG-004', 'Dove Intense Repair Shampoo 650ml',    'FMCG',           'pcs',     449.00, 'Fiber actives for damaged hair repair',                             null],
      ['SKU-FMCG-005', 'Vim Dishwash Bar 500g (Pack of 3)',    'FMCG',           'pcs',     110.00, 'Lemon power, tough grease removal',                                 null],
      ['SKU-FMCG-006', 'Harpic Power Plus 1L',                 'FMCG',           'pcs',     189.00, 'Toilet cleaner, kills 99.9% germs, stain removal',                 null],
      ['SKU-FMCG-007', 'Lux Soft Touch Soap (Pack of 8)',      'FMCG',           'box',     320.00, 'French rose and almond oil enriched',                               null],
      // Apparel (7 products)
      ['SKU-APRL-001', 'Levis 511 Slim Fit Jeans',             'Apparel',        'pcs',    3299.00, 'Classic slim fit, stretch denim, dark indigo wash',                 null],
      ['SKU-APRL-002', 'Nike Air Max 270 Running Shoes',       'Apparel',        'pcs',   12995.00, 'Max Air unit, mesh upper, lightweight cushioning',                  null],
      ['SKU-APRL-003', 'Allen Solly Regular Fit Formal Shirt', 'Apparel',        'pcs',    1799.00, 'Premium cotton, wrinkle-free, business fit',                        null],
      ['SKU-APRL-004', 'Wildcraft 45L Trekking Backpack',      'Apparel',        'pcs',    2499.00, 'Rain cover included, padded straps, multiple compartments',         null],
      ['SKU-APRL-005', 'Puma Velocity Nitro 2 Running Shoes',  'Apparel',        'pcs',    9999.00, 'NITRO foam, PUMAGRIP rubber outsole',                               null],
      ['SKU-APRL-006', 'Raymond Premium Blazer',               'Apparel',        'pcs',    8999.00, 'Wool blend, contemporary fit, notched lapel',                       null],
      ['SKU-APRL-007', 'Adidas Essentials Track Pants',        'Apparel',        'pcs',    2799.00, 'Recycled materials, tapered leg, zip pockets',                      null],
      // Food & Beverage (9 products)
      ['SKU-FOOD-001', 'Tata Salt Iodized 1kg',                'Food & Beverage', 'kg',    28.00,  'Vacuum evaporated iodized salt, Desh ka Namak',                  '2026-08-15'],
      ['SKU-FOOD-002', 'Aashirvaad Whole Wheat Atta 10kg',     'Food & Beverage', 'kg',   469.00,  '100% MP sharbati wheat, soft rotis guarantee',                   '2025-11-30'],
      ['SKU-FOOD-003', 'Fortune Sunflower Refined Oil 5L',     'Food & Beverage', 'litre',699.00,  'Light and healthy, vitamin E enriched',                          '2026-03-20'],
      ['SKU-FOOD-004', 'Maggi 2-Minute Masala Noodles (12pk)', 'Food & Beverage', 'box',  168.00,  'Quick cooking, authentic masala taste',                          '2025-09-10'],
      ['SKU-FOOD-005', 'Amul Butter 500g',                     'Food & Beverage', 'pcs',  270.00,  'Pasteurized cream butter, salted, utterly butterly',             '2025-07-05'],
      ['SKU-FOOD-006', 'Cadbury Bournvita 1kg Jar',            'Food & Beverage', 'pcs',  475.00,  'Health drink mix, vitamins D & calcium',                         '2026-01-18'],
      ['SKU-FOOD-007', 'Brooke Bond Red Label Tea 1kg',        'Food & Beverage', 'kg',   540.00,  'Natural Care, 5 Ayurvedic herbs blend',                          '2026-06-30'],
      ['SKU-FOOD-008', 'Kissan Mixed Fruit Jam 700g',          'Food & Beverage', 'pcs',  199.00,  'Real fruit ingredients, no added preservatives',                 '2025-12-25'],
      ['SKU-FOOD-009', 'Saffola Gold Pro Healthy Oil 5L',      'Food & Beverage', 'litre',899.00,  'Dual seed technology, LOSORB for less oil absorption',           '2026-04-12'],
      // Pharmaceuticals (7 products)
      ['SKU-PHRM-001', 'Crocin Advance 500mg (20 Tabs)',       'Pharmaceuticals', 'pcs',   42.00,  'Fast pain relief, paracetamol tablets',                          '2026-05-31'],
      ['SKU-PHRM-002', 'Volini Spray 100ml',                   'Pharmaceuticals', 'pcs',  265.00,  'Instant pain relief spray for muscles and joints',               '2026-09-15'],
      ['SKU-PHRM-003', 'Dolo 650mg (15 Tabs)',                 'Pharmaceuticals', 'pcs',   33.00,  'Paracetamol for fever and mild pain',                            '2025-10-20'],
      ['SKU-PHRM-004', 'Band-Aid Flexible Fabric 100ct',       'Pharmaceuticals', 'box',  449.00,  'Wound care bandages, flexible and breathable',                   '2027-02-28'],
      ['SKU-PHRM-005', 'Betadine Antiseptic Solution 100ml',   'Pharmaceuticals', 'pcs',  110.00,  'Povidone-iodine, first aid antiseptic',                          '2026-11-10'],
      ['SKU-PHRM-006', 'Electral ORS Sachets (50 Pack)',       'Pharmaceuticals', 'box',  375.00,  'WHO formula oral rehydration salts',                             '2025-08-22'],
      ['SKU-PHRM-007', 'Vicks VapoRub 50ml',                   'Pharmaceuticals', 'pcs',  155.00,  'Cold and cough topical relief ointment',                         '2026-07-14'],
      // Industrial (7 products)
      ['SKU-INDS-001', 'Bosch GSB 600 Impact Drill 13mm',      'Industrial',     'pcs',    2999.00, '600W power, variable speed, forward/reverse',                       null],
      ['SKU-INDS-002', '3M SecureFit Safety Goggles',          'Industrial',     'pcs',     520.00, 'Anti-fog, scratch resistant, UV protection',                        null],
      ['SKU-INDS-003', 'Havells MCB SP 32A C-Curve',           'Industrial',     'pcs',     285.00, 'Miniature circuit breaker, 10kA breaking capacity',                 null],
      ['SKU-INDS-004', 'Finolex FR Cable 4mm 90m Roll',        'Industrial',     'pcs',    5400.00, 'Flame retardant, HR PVC insulation, ISI certified',                 null],
      ['SKU-INDS-005', 'Asian Paints Ace Emulsion 20L',        'Industrial',     'pcs',    2800.00, 'Interior wall paint, smooth finish, economy range',                 null],
      ['SKU-INDS-006', 'Pidilite Fevicol SH 5kg',              'Industrial',     'pcs',     690.00, 'Synthetic resin adhesive for woodwork',                             null],
      ['SKU-INDS-007', 'Stanley 65-Piece Tool Kit',            'Industrial',     'pcs',    4200.00, 'Professional grade, chrome vanadium steel',                         null],
      // Stationery (7 products)
      ['SKU-STAT-001', 'Classmate Notebook 180 Pages (6-Pack)','Stationery',     'pcs',     390.00, 'Single line, A4 size, premium quality paper',                       null],
      ['SKU-STAT-002', 'Pilot V7 Hi-Tecpoint Pen (Set of 10)', 'Stationery',     'box',     850.00, 'Liquid ink, fine tip 0.7mm, assorted colors',                       null],
      ['SKU-STAT-003', 'Camel Art Kit Premium 24-Set',         'Stationery',     'pcs',     650.00, 'Watercolors, crayons, oil pastels complete set',                    null],
      ['SKU-STAT-004', 'Scotch Magic Tape Dispenser',          'Stationery',     'pcs',     180.00, 'Invisible tape, 19mm x 33m roll with dispenser',                   null],
      ['SKU-STAT-005', 'Kangaro HD-45 Heavy Duty Stapler',     'Stationery',     'pcs',     350.00, 'All steel body, 30-sheet capacity',                                 null],
      ['SKU-STAT-006', 'Faber-Castell Polychromos 24 Pencils', 'Stationery',     'pcs',    2100.00, 'Artist quality, break resistant, lightfast',                        null],
      ['SKU-STAT-007', 'JK Copier A4 Paper 500 Sheets',        'Stationery',     'pcs',     375.00, '75 GSM, multipurpose, smooth finish',                               null],
      // Home & Kitchen (4 products)
      ['SKU-HOME-001', 'Prestige Iris 750W Mixer Grinder',     'Home & Kitchen', 'pcs',    3199.00, '3 stainless steel jars, super silent motor',                        null],
      ['SKU-HOME-002', 'Milton Thermosteel Flask 1L',          'Home & Kitchen', 'pcs',     899.00, '24-hour hot and cold insulation, leak proof',                       null],
      ['SKU-HOME-003', 'Hawkins Contura 5L Pressure Cooker',   'Home & Kitchen', 'pcs',    2850.00, 'Hard anodized, induction compatible, ISI certified',                null],
      ['SKU-HOME-004', 'Pigeon by Stovekraft Non-Stick Tawa',  'Home & Kitchen', 'pcs',     599.00, '260mm induction base, wooden handle',                               null],
      // Personal Care (3 products)
      ['SKU-CARE-001', 'Nivea Men Deep Impact Face Wash 100ml','Personal Care',  'pcs',     249.00, 'Activated charcoal, dark spot reduction',                           null],
      ['SKU-CARE-002', 'Biotique Bio Morning Nectar Lotion',   'Personal Care',  'pcs',     199.00, 'Moisturizing lotion for all skin types',                            null],
      ['SKU-CARE-003', 'Philips BT3211 Beard Trimmer',         'Personal Care',  'pcs',    1599.00, 'DuraPower technology, 60 min cordless, 20 lengths',                 null],
      // Sports & Fitness (3 products)
      ['SKU-SPRT-001', 'Cosco Cricket Bat Kashmir Willow',     'Sports & Fitness','pcs',   1899.00, 'Full size, thick edge, rubber grip',                                null],
      ['SKU-SPRT-002', 'Nivia Dominator Football Size 5',      'Sports & Fitness','pcs',    799.00, 'Rubberized moulded, all surface, hand stitched',                    null],
      ['SKU-SPRT-003', 'PowerMax TDM-98 Treadmill',            'Sports & Fitness','pcs',  24999.00, '2HP motor, 12 programs, 120kg max weight',                          null],
    ];

    for (const [sku, name, cat, unit, price, desc, expiry] of productData) {
      const r = await client.query(
        'INSERT INTO products (sku, name, category_id, unit, price, description, expiry_date, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING product_id',
        [sku, name, categories[cat], unit, price, desc, expiry || null, users['Raj Sharma']]
      );
      products[sku] = r.rows[0].product_id;
    }
    const productSkus = Object.keys(products);

    // ══════ INVENTORY ══════
    console.log('📊 Creating inventory records...');
    const inventoryMap = {};

    for (const sku of productSkus) {
      // Each product goes in 2-4 warehouses with random distribution
      const numWarehouses = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...warehouseIds].sort(() => Math.random() - 0.5);
      const selectedWarehouses = shuffled.slice(0, numWarehouses);

      for (const whId of selectedWarehouses) {
        const quantity = 20 + Math.floor(Math.random() * 280); // 20 - 300
        const reorderLevel = 10 + Math.floor(Math.random() * 30); // 10 - 40
        const r = await client.query(
          'INSERT INTO inventory (warehouse_id, product_id, quantity, reorder_level) VALUES ($1,$2,$3,$4) RETURNING inventory_id',
          [whId, products[sku], quantity, reorderLevel]
        );
        const key = `${whId}_${products[sku]}`;
        inventoryMap[key] = { inventoryId: r.rows[0].inventory_id, quantity };
      }
    }

    // ══════ TRANSACTIONS (500+) ══════
    console.log('🔄 Generating transaction history (30 days)...');
    const invKeys = Object.keys(inventoryMap);
    let txnCount = 0;
    const userIds = Object.values(users);

    // Generate transactions for the past 30 days
    for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0];

      // Generate 15-25 transactions per day
      const numTxns = 15 + Math.floor(Math.random() * 11);

      for (let t = 0; t < numTxns; t++) {
        const invKey = invKeys[Math.floor(Math.random() * invKeys.length)];
        const inv = inventoryMap[invKey];
        const userId = userIds[Math.floor(Math.random() * userIds.length)];

        // Weight distribution: 40% stock_in, 45% stock_out, 15% other
        const rand = Math.random();
        let txnType, qty;

        if (rand < 0.40) {
          txnType = 'stock_in';
          qty = 5 + Math.floor(Math.random() * 50); // 5-55
        } else if (rand < 0.85) {
          txnType = 'stock_out';
          qty = 1 + Math.floor(Math.random() * 20); // 1-21
          if (qty > inv.quantity) qty = Math.max(1, Math.floor(inv.quantity / 2));
        } else {
          txnType = Math.random() < 0.5 ? 'return_in' : 'adjustment';
          qty = 1 + Math.floor(Math.random() * 10);
        }

        if (qty <= 0) qty = 1;

        const hour = 8 + Math.floor(Math.random() * 10);
        const minute = Math.floor(Math.random() * 60);
        const timestamp = `${dateStr} ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}:00`;

        const notes = {
          stock_in: ['Purchase order received', 'Monthly restock', 'Emergency restock', 'Supplier delivery', 'Bulk purchase'],
          stock_out: ['Customer order fulfilled', 'Retail dispatch', 'Wholesale order', 'Online order shipment', 'Walk-in sale'],
          return_in: ['Customer return - defective', 'Customer return - wrong item', 'Exchange return'],
          adjustment: ['Physical count adjustment', 'Damaged goods written off', 'Inventory audit correction'],
        };
        const noteList = notes[txnType] || ['Transaction'];
        const note = noteList[Math.floor(Math.random() * noteList.length)];

        await client.query(
          `INSERT INTO transactions (inventory_id, txn_type, quantity, note, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [inv.inventoryId, txnType, qty, note, userId, timestamp]
        );

        // Update running quantity
        if (txnType === 'stock_in' || txnType === 'return_in') {
          inv.quantity += qty;
        } else if (txnType === 'stock_out') {
          inv.quantity = Math.max(0, inv.quantity - qty);
        }

        txnCount++;
      }
    }

    // Create some spike transactions for anomaly detection
    console.log('⚡ Creating anomaly spike transactions...');
    const spikeProducts = productSkus.slice(0, 5);
    for (const sku of spikeProducts) {
      const invKey = invKeys.find(k => k.includes(products[sku]));
      if (!invKey) continue;
      const inv = inventoryMap[invKey];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Large spike transaction
      const spikeQty = 80 + Math.floor(Math.random() * 120);
      await client.query(
        `INSERT INTO transactions (inventory_id, txn_type, quantity, note, created_by, created_at)
         VALUES ($1, 'stock_out', $2, 'Large bulk order - corporate client', $3, $4)`,
        [inv.inventoryId, spikeQty, users['Raj Sharma'], `${dateStr} 14:30:00`]
      );
      inv.quantity = Math.max(0, inv.quantity - spikeQty);
      txnCount++;
    }

    // Set some products to very low stock for restock alerts
    console.log('📉 Setting low stock for restock alerts...');
    const lowStockProducts = productSkus.slice(5, 12);
    for (const sku of lowStockProducts) {
      const invKey = invKeys.find(k => k.includes(products[sku]));
      if (!invKey) continue;
      const inv = inventoryMap[invKey];
      const lowQty = 2 + Math.floor(Math.random() * 8);
      await client.query(
        'UPDATE inventory SET quantity = $1 WHERE inventory_id = $2',
        [lowQty, inv.inventoryId]
      );
      inv.quantity = lowQty;
    }

    // Update all inventory quantities to match transaction sums
    console.log('🔢 Syncing inventory quantities...');
    for (const invKey of invKeys) {
      const inv = inventoryMap[invKey];
      await client.query(
        'UPDATE inventory SET quantity = GREATEST(0, $1), last_updated = NOW() WHERE inventory_id = $2',
        [inv.quantity, inv.inventoryId]
      );
    }

    // ══════ ORDERS (35+) ══════
    console.log('📝 Creating orders...');
    const customers = [
      ['Reliance Fresh Stores', 'RF-2024-001'], ['Big Bazaar Ahmedabad', 'BB-AMD-045'],
      ['D-Mart Wholesale', 'DM-WH-112'], ['Metro Cash & Carry', 'MCC-GJ-078'],
      ['Star Bazaar Surat', 'SB-SRT-023'], ['Spencer Retail', 'SR-MUM-056'],
      ['More Retail', 'MR-VAD-089'], ['Vishal Mega Mart', 'VMM-RJK-034'],
      ['Lulu Hypermarket', 'LH-AMD-091'], ['Aditya Birla Retail', 'ABR-SRT-067'],
      ['Easy Day', 'ED-MUM-012'], ['Nilgiris', 'NL-PUN-045'],
      ['Ratnadeep Fresh', 'RD-HYD-078'], ['Nature Basket', 'NB-BLR-034'],
      ['Freshworld Supermarket', 'FW-CHN-056'],
    ];
    const statuses = ['draft', 'confirmed', 'dispatched', 'completed', 'completed', 'completed', 'cancelled'];

    for (let i = 0; i < 35; i++) {
      const customer = customers[i % customers.length];
      const whId = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const daysAgo = Math.floor(Math.random() * 28);
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - daysAgo);

      // Pick 2-5 random products for this order
      const numItems = 2 + Math.floor(Math.random() * 4);
      const orderProducts = [...productSkus].sort(() => Math.random() - 0.5).slice(0, numItems);

      let totalValue = 0;
      const items = [];
      for (const sku of orderProducts) {
        const prod = productData.find(p => p[0] === sku);
        if (!prod) continue;
        const qty = 1 + Math.floor(Math.random() * 15);
        items.push({ product_id: products[sku], quantity: qty, unit_price: prod[4] });
        totalValue += qty * prod[4];
      }

      const orderResult = await client.query(
        `INSERT INTO orders (warehouse_id, status, customer_name, customer_ref, total_value, notes, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING order_id`,
        [whId, status, customer[0], customer[1], totalValue, `Order for ${customer[0]}`, users['Priya Patel'], orderDate.toISOString()]
      );
      const orderId = orderResult.rows[0].order_id;

      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
          [orderId, item.product_id, item.quantity, item.unit_price]
        );
      }
    }

    // ══════ RETURNS (18) ══════
    console.log('↩️  Creating returns...');
    const returnReasons = [
      'Product damaged during shipping', 'Wrong item delivered', 'Customer changed mind',
      'Quality not as expected', 'Expired product received', 'Defective unit',
      'Size mismatch', 'Duplicate order placed', 'Better price found elsewhere',
    ];

    for (let i = 0; i < 18; i++) {
      const whId = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
      const sku = productSkus[Math.floor(Math.random() * productSkus.length)];
      const returnType = Math.random() < 0.7 ? 'customer_return' : 'supplier_return';
      const qty = 1 + Math.floor(Math.random() * 5);
      const reason = returnReasons[Math.floor(Math.random() * returnReasons.length)];
      const daysAgo = Math.floor(Math.random() * 20);
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() - daysAgo);

      await client.query(
        `INSERT INTO returns (warehouse_id, product_id, return_type, quantity, reason, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [whId, products[sku], returnType, qty, reason, users['Arun Singh'], returnDate.toISOString()]
      );
    }

    // ══════ TRANSFERS (12) ══════
    console.log('🔀 Creating transfers...');
    for (let i = 0; i < 12; i++) {
      const fromWh = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
      let toWh = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
      while (toWh === fromWh) toWh = warehouseIds[Math.floor(Math.random() * warehouseIds.length)];
      const sku = productSkus[Math.floor(Math.random() * productSkus.length)];
      const qty = 5 + Math.floor(Math.random() * 30);
      const daysAgo = Math.floor(Math.random() * 15);
      const transferDate = new Date();
      transferDate.setDate(transferDate.getDate() - daysAgo);

      await client.query(
        `INSERT INTO transfers (from_warehouse_id, to_warehouse_id, product_id, quantity, note, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [fromWh, toWh, products[sku], qty, `Inter-warehouse rebalancing`, users['Vikram Mehta'], transferDate.toISOString()]
      );
    }

    await client.query('COMMIT');

    console.log(`\n✅ Seed complete!`);
    console.log(`   📁 ${catData.length} categories`);
    console.log(`   👥 ${userData.length} users`);
    console.log(`   🏢 ${whData.length} warehouses`);
    console.log(`   🤝 ${supplierData.length} suppliers`);
    console.log(`   📦 ${productData.length} products`);
    console.log(`   📊 ${invKeys.length} inventory records`);
    console.log(`   🔄 ${txnCount} transactions`);
    console.log(`   📝 35 orders`);
    console.log(`   ↩️  18 returns`);
    console.log(`   🔀 12 transfers`);
    console.log(`\n   🔑 Login credentials (all passwords: Admin@123):`);
    console.log(`   Admin:   admin@inveniq.com`);
    console.log(`   Manager: manager@inveniq.com`);
    console.log(`   Staff:   staff@inveniq.com`);
    console.log(`   Viewer:  viewer@inveniq.com\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
