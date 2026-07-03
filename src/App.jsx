import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { UploadCloud, Zap, Box, Snowflake, Search as SearchIcon, LayoutDashboard, MapPin, Package, Truck } from 'lucide-react';
import './App.css';

const STACK_COLORS = ['#FF8A00', '#B4F557', '#00E5FF', '#FF61A6', '#818CF8'];
const DONUT_COLORS = ['#FF8A00', '#B4F557', '#00E5FF', '#FF61A6', '#818CF8'];

const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);
const formatK = (num) => num > 1000 ? (num / 1000).toFixed(1) + 'K' : num;

// ─── Data Processing ─────────────────────────────────────────────────────────
function processRow(row) {
  const rawDest = row['판매처명'] || row['Destination'] || '기타';
  const remark = String(row['비고'] || row['Remark'] || '').trim();
  let displayDest = rawDest;
  let division = '';

  if (rawDest.includes('엘에스오토모티브') || rawDest.includes('LS Automotive')) {
    displayDest = 'LS';
    if (remark.includes('전장')) division = '전장';
    else if (remark.toLowerCase().includes('hmi')) division = 'HMI';
    else if (remark.includes('멕시코')) division = '멕시코';
    else if (remark.includes('청도')) division = '청도';
    else if (remark.includes('첸나이')) division = '첸나이';
    else division = remark || '기타';
  } else if (rawDest.includes('현대모비스') || rawDest.includes('모비스')) {
    let sub = '';
    if (remark.includes('진천') || remark.includes('문백')) sub = '진천문백';
    else if (remark.includes('오토닉스')) sub = '오토닉스';
    else if (remark.includes('충주')) sub = '충주';
    displayDest = sub ? `현대모비스 ${sub}` : '현대모비스';
  }

  return {
    itemName: row['품목명'] || row['Item'] || '미정',
    quantity: parseInt(row['출고수량'] || row['Qty']) || 0,
    type: row['배송유형'] || row['Type'] || '기타',
    destination: displayDest,
    division,
    rawDest,
    remark,
    date: row['출고확정일자'] || row['Date'] || '',
  };
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentMonth, setCurrentMonth] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); };

  const loadFile = (file) => {
    setIsProcessing(true);
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        setData(XLSX.utils.sheet_to_json(ws).map(processRow));
        setCurrentMonth('전체');
        setSearchQuery('');
        setActiveTab('overview');
        setIsProcessing(false);
      };
      reader.readAsBinaryString(file);
    }, 50);
  };

  const availableMonths = useMemo(() => {
    if (!data) return [];
    const s = new Set(data.map(d => d.date ? (d.date.split('.')[1] || '기타') + '월' : '기타'));
    return ['전체', ...Array.from(s).sort()];
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    let r = data;
    if (currentMonth !== '전체') r = r.filter(d => (d.date ? (d.date.split('.')[1] || '기타') + '월' : '기타') === currentMonth);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(d => d.itemName.toLowerCase().includes(q) || d.destination.toLowerCase().includes(q));
    }
    return r;
  }, [data, currentMonth, searchQuery]);

  const metrics = useMemo(() => {
    if (!filteredData.length) return null;

    const weekDaysArr = ['일', '월', '화', '수', '목', '금', '토'];
    const weekOrder = ['월', '화', '수', '목', '금', '토', '일'];

    // KPIs
    const totalQuantity = filteredData.reduce((s, d) => s + d.quantity, 0);
    const uniqueSKUs = new Set(filteredData.map(d => d.itemName)).size;
    const dates = filteredData.map(d => d.date).filter(Boolean).sort();
    const periodStr = dates.length ? `${dates[0].replace(/\./g,'-')} ~ ${dates[dates.length-1].replace(/\./g,'-')}` : '-';
    const uniqueTripsAll = new Set(filteredData.map(d => `${d.date}||${d.destination}`)).size;

    // Trend
    const trendMap = {};
    const srcData = currentMonth === '전체' ? (data || []) : filteredData;
    srcData.forEach(d => {
      const k = currentMonth === '전체'
        ? (d.date ? (d.date.split('.')[1] || '기타') + '월' : '기타')
        : (d.date ? d.date.replace(/\./g,'-') : '기타');
      trendMap[k] = (trendMap[k] || 0) + d.quantity;
    });
    const trendData = Object.keys(trendMap).sort().map(k => ({ name: k, value: trendMap[k] }));
    const trendTitle = currentMonth === '전체' ? '월별 출고 물량 추이' : `${currentMonth} 일별 추이`;

    // Weekday
    const weekMap = { '월':0,'화':0,'수':0,'목':0,'금':0,'토':0,'일':0 };
    filteredData.forEach(d => {
      if (d.date) { const wd = new Date(d.date.replace(/\./g,'-')); if (!isNaN(wd)) weekMap[weekDaysArr[wd.getDay()]] += d.quantity; }
    });
    const weekdayTrend = weekOrder.map(k => ({ name: k, value: weekMap[k] }));

    // Destinations
    const destMap = {};
    const destChannelMap = {};
    const channelSet = new Set();
    filteredData.forEach(d => {
      const tk = `${d.date}||${d.destination}`;
      if (!destMap[d.destination]) destMap[d.destination] = { name: d.destination, qty: 0, orders: 0, trips: new Set() };
      destMap[d.destination].qty += d.quantity;
      if (!destMap[d.destination].trips.has(tk)) { destMap[d.destination].orders++; destMap[d.destination].trips.add(tk); }

      if (!destChannelMap[d.destination]) destChannelMap[d.destination] = { name: d.destination, total: 0 };
      destChannelMap[d.destination][d.type] = (destChannelMap[d.destination][d.type] || 0) + d.quantity;
      destChannelMap[d.destination].total += d.quantity;
      channelSet.add(d.type);
    });
    const allDestinations = Object.values(destMap).sort((a,b) => b.qty - a.qty);
    const topDestChannels = Object.values(destChannelMap).sort((a,b) => b.total - a.total).slice(0,5);
    const allChannelNames = Array.from(channelSet);

    // Channels
    const typeMap = {};
    const channelDetailMap = {};
    const gTrips = {};

    filteredData.forEach(d => {
      const tk = `${d.date}||${d.destination}`;
      if (!typeMap[d.type]) typeMap[d.type] = { name: d.type, qty: 0, orders: 0 };
      typeMap[d.type].qty += d.quantity;
      if (!gTrips[d.type]) gTrips[d.type] = new Set();
      if (!gTrips[d.type].has(tk)) { typeMap[d.type].orders++; gTrips[d.type].add(tk); }

      if (!channelDetailMap[d.type]) channelDetailMap[d.type] = { monthlyMap: {}, destMap: {}, itemMap: {}, destDetailMap: {} };
      const cd = channelDetailMap[d.type];
      const mk = d.date ? (d.date.split('.')[1] || '기타') + '월' : '기타';

      if (!cd.monthlyMap[mk]) cd.monthlyMap[mk] = { qty:0, orders:0, dests: new Set(), items: new Set(), trips: new Set() };
      cd.monthlyMap[mk].qty += d.quantity;
      if (!cd.monthlyMap[mk].trips.has(tk)) { cd.monthlyMap[mk].orders++; cd.monthlyMap[mk].trips.add(tk); }
      cd.monthlyMap[mk].dests.add(d.destination);
      cd.monthlyMap[mk].items.add(d.itemName);

      if (!cd.destMap[d.destination]) cd.destMap[d.destination] = { name: d.destination, qty:0, orders:0, trips: new Set() };
      cd.destMap[d.destination].qty += d.quantity;
      if (!cd.destMap[d.destination].trips.has(tk)) { cd.destMap[d.destination].orders++; cd.destMap[d.destination].trips.add(tk); }

      if (!cd.itemMap[d.itemName]) cd.itemMap[d.itemName] = { name: d.itemName, qty:0, orders:0 };
      cd.itemMap[d.itemName].qty += d.quantity;
      cd.itemMap[d.itemName].orders++;

      if (!cd.destDetailMap[d.destination]) cd.destDetailMap[d.destination] = { monthlyMap:{}, weekdayMap:{'월':0,'화':0,'수':0,'목':0,'금':0,'토':0,'일':0}, itemMap:{}, dateTrips: new Set() };
      const dd = cd.destDetailMap[d.destination];
      if (!dd.monthlyMap[mk]) dd.monthlyMap[mk] = { qty:0, orders:0, dates: new Set() };
      dd.monthlyMap[mk].qty += d.quantity;
      if (!dd.monthlyMap[mk].dates.has(d.date)) { dd.monthlyMap[mk].orders++; dd.monthlyMap[mk].dates.add(d.date); }
      if (d.date && !dd.dateTrips.has(d.date)) {
        dd.dateTrips.add(d.date);
        const wd = new Date(d.date.replace(/\./g,'-'));
        if (!isNaN(wd)) dd.weekdayMap[weekDaysArr[wd.getDay()]]++;
      }
      if (!dd.itemMap[d.itemName]) dd.itemMap[d.itemName] = { name: d.itemName, qty:0, orders:0 };
      dd.itemMap[d.itemName].qty += d.quantity;
      dd.itemMap[d.itemName].orders++;
    });

    const deliveryTypes = Object.values(typeMap).map(t => ({ name: t.name, value: t.qty }));
    const allChannels = Object.values(typeMap).sort((a,b) => b.qty - a.qty);

    // ABC Pareto
    const skuMap = {};
    let totalSkuQty = 0;
    filteredData.forEach(d => {
      if (!skuMap[d.itemName]) skuMap[d.itemName] = { name: d.itemName, count:0, qty:0, lastDate: d.date };
      skuMap[d.itemName].count++;
      skuMap[d.itemName].qty += d.quantity;
      totalSkuQty += d.quantity;
      if (d.date > skuMap[d.itemName].lastDate) skuMap[d.itemName].lastDate = d.date;
    });
    let cum = 0;
    const allItems = Object.values(skuMap).sort((a,b) => b.qty - a.qty).map(s => {
      cum += s.qty;
      const pct = cum / totalSkuQty;
      const category = pct <= 0.80 ? 'A등급' : pct <= 0.95 ? 'B등급' : 'C등급';
      const risk = pct > 0.95 && s.count <= 2 ? 'High' : pct > 0.95 ? 'Medium' : 'Low';
      return { ...s, category, risk };
    });

    return {
      totalQuantity, uniqueSKUs, periodStr, uniqueTripsAll,
      trendData, trendTitle, weekdayTrend,
      allDestinations, topDestChannels, allChannelNames,
      deliveryTypes, allChannels, channelDetailMap,
      allItems,
    };
  }, [data, filteredData, currentMonth]);

  // ── Upload Screen ──────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>WMS Logistics Intelligence</h1>
        <p className="subtitle" style={{ marginBottom: 40 }}>출고 전략 데이터 분석 대시보드</p>
        <div
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          style={{ width: '100%', maxWidth: 600 }}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          onClick={() => document.getElementById('fileUpload').click()}
        >
          {isProcessing ? (
            <>
              <div className="spinner" style={{ marginBottom: 20 }}></div>
              <div className="upload-text">데이터를 분석하고 있습니다...</div>
              <div className="upload-subtext">잠시만 기다려주세요</div>
            </>
          ) : (
            <>
              <UploadCloud className="upload-icon" size={64} />
              <div className="upload-text">엑셀 파일을 드래그하거나 클릭하여 업로드</div>
              <div className="upload-subtext">지원 포맷: .xlsx, .xls, .csv</div>
            </>
          )}
          <input id="fileUpload" type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      </div>
    );
  }

  // ── Main App Shell ─────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview',  label: '종합 대시보드', icon: <LayoutDashboard size={16} /> },
    { id: 'channels',  label: '배송 채널',     icon: <Truck size={16} /> },
    { id: 'dests',     label: '납품처 분석',   icon: <MapPin size={16} /> },
    { id: 'items',     label: '품목 분석',     icon: <Package size={16} /> },
  ];

  return (
    <div className="dashboard-container">
      {/* ── Top Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:'1.6rem' }}>WMS Logistics Intelligence</h1>
          <p className="subtitle" style={{ margin:'4px 0 0' }}>파레토 기반 통합 물류 인사이트 · {metrics?.periodStr}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ position:'relative' }}>
            <SearchIcon size={16} color="var(--text-muted)" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }} />
            <input
              type="text" placeholder="품목명 또는 납품처 검색..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ padding:'8px 14px 8px 34px', borderRadius:8, border:'1px solid var(--card-border)', background:'rgba(255,255,255,0.05)', color:'var(--text-main)', width:220, outline:'none', fontSize:'0.9rem' }}
            />
          </div>
          <button
            onClick={() => { setData(null); }}
            style={{ background:'transparent', border:'1px solid var(--card-border)', color:'var(--text-muted)', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:'0.85rem' }}
          >파일 재설정</button>
        </div>
      </div>

      {/* ── Month Filter ── */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ color:'var(--text-muted)', fontWeight:600, fontSize:'0.85rem', marginRight:4 }}>기간:</span>
        {availableMonths.map(m => (
          <button key={m} onClick={() => setCurrentMonth(m)} style={{
            padding:'6px 14px', borderRadius:8, fontSize:'0.85rem',
            border:`1px solid ${currentMonth===m ? 'var(--accent-neon)' : 'var(--card-border)'}`,
            background: currentMonth===m ? 'rgba(255,138,0,0.15)' : 'transparent',
            color: currentMonth===m ? 'var(--accent-neon)' : 'var(--text-main)',
            cursor:'pointer', fontWeight: currentMonth===m ? 700 : 500, transition:'all 0.2s'
          }}>{m === '전체' ? '전체 기간' : m}</button>
        ))}
        {searchQuery && <span style={{ marginLeft:8, color:'var(--accent-neon)', fontSize:'0.82rem' }}>검색 중: "{searchQuery}"</span>}
      </div>

      {/* ── KPI Bar ── */}
      {metrics && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'총 출고 수량', value: formatNumber(metrics.totalQuantity), accent: true },
            { label:'납품 출고 횟수', value: formatNumber(metrics.uniqueTripsAll) + '회' },
            { label:'활성 SKU', value: formatNumber(metrics.uniqueSKUs) + '종' },
            { label:'납품처 수', value: formatNumber(metrics.allDestinations.length) + '개소' },
          ].map((k,i) => (
            <div key={i} className="card" style={{ padding:'16px 20px', borderLeft: k.accent ? '3px solid var(--accent-neon)' : '3px solid var(--card-border)' }}>
              <div style={{ fontSize:'0.9rem', color:'var(--text-main)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:'1.6rem', fontWeight:800, color: k.accent ? 'var(--accent-neon)' : 'var(--text-main)', fontFamily:'monospace' }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab Nav ── */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--card-border)', paddingBottom:0 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'10px 20px', borderRadius:'8px 8px 0 0',
            border: activeTab===tab.id ? '1px solid var(--card-border)' : '1px solid transparent',
            borderBottom: activeTab===tab.id ? '2px solid var(--accent-neon)' : '1px solid var(--card-border)',
            background: activeTab===tab.id ? 'var(--card-bg)' : 'transparent',
            color: activeTab===tab.id ? 'var(--accent-neon)' : 'var(--text-muted)',
            cursor:'pointer', fontWeight: activeTab===tab.id ? 700 : 400,
            fontSize:'0.9rem', transition:'all 0.2s', marginBottom:-1,
          }}>{tab.icon}{tab.label}</button>
        ))}
      </div>

      {/* ── No Data State ── */}
      {!metrics && (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}>
          <p>현재 조건에 해당하는 데이터가 없습니다.</p>
          <button onClick={() => { setSearchQuery(''); setCurrentMonth('전체'); }} style={{ marginTop:12, padding:'8px 20px', border:'1px solid var(--card-border)', borderRadius:8, background:'transparent', color:'var(--text-muted)', cursor:'pointer' }}>필터 초기화</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && metrics && (
        <div>
          {/* Row 1: Trend + Weekday */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div className="card">
              <h2 style={{ marginBottom:16 }}>{metrics.trendTitle}</h2>
              <div style={{ height:260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.trendData} margin={{ top:10, right:20, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-neon)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--accent-neon)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                    <YAxis stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                    <RechartsTooltip contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }}  itemStyle={{ color: 'var(--text-main)' }} />
                    <Area type="monotone" dataKey="value" name="출고수량" stroke="var(--accent-neon)" strokeWidth={3} fillOpacity={1} fill="url(#trendGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h2 style={{ marginBottom:16 }}>요일별 출고 집중도</h2>
              <div style={{ height:260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.weekdayTrend} margin={{ top:10, right:10, left:-10, bottom:0 }}>
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill:'var(--text-muted)'}} />
                    <YAxis stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                    <RechartsTooltip cursor={{fill:'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }} itemStyle={{ color: 'var(--text-main)' }} />
                    <Bar dataKey="value" name="출고수량" radius={[4,4,0,0]}>
                      {metrics.weekdayTrend.map((entry, i) => (
                        <Cell key={i} fill={entry.value === Math.max(...metrics.weekdayTrend.map(r=>r.value)) ? 'var(--accent-neon)' : '#2DD4BF'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Channel Donut + Top Dest Stacked */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16, marginBottom:16 }}>
            <div className="card">
              <h2 style={{ marginBottom:16 }}>배송 채널 비중</h2>
              <div style={{ height:260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={metrics.deliveryTypes} cx="50%" cy="45%" innerRadius={55} outerRadius={80}
                      paddingAngle={4} dataKey="value" stroke="none"
                      label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}
                    >
                      {metrics.deliveryTypes.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }}  itemStyle={{ color: 'var(--text-main)' }} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color:'var(--text-main)', fontSize:'0.85rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p style={{ textAlign:'center', fontSize:'0.78rem', color:'var(--text-muted)', marginTop:8 }}>
                💡 <button onClick={() => setActiveTab('channels')} style={{ background:'none', border:'none', color:'var(--accent-neon)', cursor:'pointer', fontSize:'0.78rem', padding:0 }}>채널 상세 분석 →</button>
              </p>
            </div>
            <div className="card">
              <h2 style={{ marginBottom:16 }}>TOP 5 납품처별 배송 채널 분포</h2>
              <div style={{ height:260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.topDestChannels} layout="vertical" margin={{ top:5, right:30, left:10, bottom:5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" interval={0} stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} width={140} />
                    <RechartsTooltip cursor={{fill:'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }} itemStyle={{ color: 'var(--text-main)' }} />
                    <Legend verticalAlign="bottom" wrapperStyle={{ color:'var(--text-main)', fontSize:'0.8rem' }} />
                    {metrics.allChannelNames.map((ch, i) => (
                      <Bar key={ch} dataKey={ch} stackId="a" fill={STACK_COLORS[i % STACK_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ textAlign:'right', fontSize:'0.78rem', color:'var(--text-muted)', marginTop:8 }}>
                <button onClick={() => setActiveTab('dests')} style={{ background:'none', border:'none', color:'var(--accent-neon)', cursor:'pointer', fontSize:'0.78rem', padding:0 }}>전체 납품처 분석 →</button>
              </p>
            </div>
          </div>

          {/* Row 3: ABC quick summary */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ margin:0 }}>품목 ABC 파레토 분류 요약</h2>
              <button onClick={() => setActiveTab('items')} style={{ background:'none', border:'none', color:'var(--accent-neon)', cursor:'pointer', fontSize:'0.85rem', fontWeight:600 }}>전체 품목 분석 →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { grade:'A등급', label:'High-Runner', desc:'핵심 80% 물량', icon:<Zap size={24}/>, color:'var(--accent-neon)' },
                { grade:'B등급', label:'Bulk-Mover',  desc:'80~95% 구간',   icon:<Box size={24}/>,      color:'#38BDF8' },
                { grade:'C등급', label:'Slow-Mover',  desc:'장기 재고 주의', icon:<Snowflake size={24}/>,color:'var(--text-muted)' },
              ].map(g => {
                const cnt = metrics.allItems.filter(i => i.category === g.grade).length;
                return (
                  <div key={g.grade} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid var(--card-border)`, borderRadius:10, padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{ color: g.color }}>{g.icon}</div>
                    <div>
                      <div style={{ fontWeight:700, color: g.color }}>{g.grade}</div>
                      <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{g.label} · {g.desc}</div>
                      <div style={{ fontSize:'1.2rem', fontWeight:800, marginTop:4 }}>{cnt}종</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: CHANNELS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'channels' && metrics && (
        <ChannelTab metrics={metrics} filteredData={filteredData} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: DESTINATIONS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dests' && metrics && (
        <DestTab allDestinations={metrics.allDestinations} topDestChannels={metrics.topDestChannels} allChannelNames={metrics.allChannelNames} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: ITEMS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'items' && metrics && (
        <ItemTab allItems={metrics.allItems} />
      )}
    </div>
  );
}

// ─── Tab 2: Channel Analysis ─────────────────────────────────────────────────
function ChannelTab({ metrics, filteredData }) {
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [subTab, setSubTab] = useState('monthly');
  const [expandedMonth, setExpandedMonth] = useState(null);

  const cd = selectedChannel ? metrics.channelDetailMap[selectedChannel] : null;

  const monthlyRows = cd
    ? Object.keys(cd.monthlyMap).sort().map(m => ({
        month: m, ...cd.monthlyMap[m],
        destList: Array.from(cd.monthlyMap[m].dests),
        itemList: Array.from(cd.monthlyMap[m].items),
      }))
    : [];

  const destRows = cd ? Object.values(cd.destMap).sort((a,b) => b.qty - a.qty) : [];
  const itemRows = cd ? Object.values(cd.itemMap).sort((a,b) => b.qty - a.qty) : [];

  const isMonthlyView = Object.keys(cd?.monthlyMap || {}).length !== 1;
  const timeSeriesRows = useMemo(() => {
    if (!cd || !selectedChannel) return [];
    if (isMonthlyView) {
      return Object.keys(cd.monthlyMap).sort().map(m => ({
        name: m, qty: cd.monthlyMap[m].qty, orders: cd.monthlyMap[m].orders
      }));
    } else {
      const dailyMap = {};
      filteredData.forEach(d => {
        if (d.type === selectedChannel && d.date) {
          if (!dailyMap[d.date]) dailyMap[d.date] = { qty: 0, orders: 0, trips: new Set() };
          dailyMap[d.date].qty += d.quantity;
          const tk = `${d.date}||${d.destination}`;
          if (!dailyMap[d.date].trips.has(tk)) {
            dailyMap[d.date].orders++;
            dailyMap[d.date].trips.add(tk);
          }
        }
      });
      return Object.keys(dailyMap).sort().map(d => ({
        name: (d.split('.')[2] || d) + '일',
        qty: dailyMap[d].qty,
        orders: dailyMap[d].orders
      }));
    }
  }, [cd, selectedChannel, filteredData, isMonthlyView]);

  return (
    <div>
      {/* Channel Overview Chart + Table side-by-side */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Donut */}
        <div className="card">
          <h2 style={{ marginBottom:12 }}>채널별 출고 비중</h2>
          <div style={{ height:220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.deliveryTypes} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                  paddingAngle={4} dataKey="value" stroke="none"
                  label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}
                >
                  {metrics.deliveryTypes.map((_,i) => <Cell key={i} fill={DONUT_COLORS[i%DONUT_COLORS.length]} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }}  itemStyle={{ color: 'var(--text-main)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Channel Table */}
        <div className="card">
          <h2 style={{ marginBottom:12 }}>채널별 실적 <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:400 }}>— 클릭하면 상세 분석</span></h2>
          <table className="data-table">
            <thead><tr><th>채널</th><th>납품 횟수</th><th>총 출고량</th></tr></thead>
            <tbody>
              {metrics.allChannels.map((c, i) => (
                <tr key={i}
                  onClick={() => { setSelectedChannel(selectedChannel === c.name ? null : c.name); setSubTab('monthly'); setExpandedMonth(null); }}
                  style={{ cursor:'pointer', background: selectedChannel===c.name ? 'rgba(255,138,0,0.08)' : 'transparent', borderLeft: selectedChannel===c.name ? '3px solid var(--accent-neon)' : '3px solid transparent', transition:'all 0.2s' }}
                >
                  <td style={{ fontWeight:700, color: selectedChannel===c.name ? 'var(--accent-neon)' : 'var(--text-main)' }}>
                    {c.name} {selectedChannel===c.name ? '▼' : '▶'}
                  </td>
                  <td>{formatNumber(c.orders)}회</td>
                  <td style={{ color:'var(--accent-neon)' }}>{formatNumber(c.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down */}
      {selectedChannel && cd && (
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <h2 style={{ margin:0 }}>📦 <span style={{ color:'var(--accent-neon)' }}>{selectedChannel}</span> 상세 분석</h2>
            <div style={{ display:'flex', gap:8 }}>
              {[['monthly', isMonthlyView ? '📅 월별' : '📅 일별'], ['dest','🏢 납품처'], ['item','📋 품목']].map(([id, label]) => (
                <button key={id} onClick={() => setSubTab(id)} style={{
                  padding:'7px 16px', background: subTab===id ? 'rgba(255,138,0,0.15)' : 'transparent',
                  color: subTab===id ? 'var(--accent-neon)' : 'var(--text-main)', border:'1px solid var(--accent-neon)',
                  borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:'0.85rem', transition:'all 0.2s'
                }}>{label}</button>
              ))}
            </div>
          </div>

          {subTab === 'monthly' && (
            <div>
              <div style={{ height:220, marginBottom:20 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesRows} margin={{ top:10, right:20, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="chGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-neon)" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="var(--accent-neon)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                    <YAxis stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                    <RechartsTooltip contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }} itemStyle={{ color: 'var(--text-main)' }} />
                    <Area type="monotone" dataKey="qty" name="출고수량" stroke="var(--accent-neon)" strokeWidth={3} fillOpacity={1} fill="url(#chGrad)" />
                    <Area type="monotone" dataKey="orders" name="납품횟수" stroke="#38BDF8" strokeWidth={2} fill="none" strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <table className="data-table">
                <thead><tr><th>월</th><th>납품 횟수</th><th>출고 수량</th><th>납품처</th><th>품목수</th><th></th></tr></thead>
                <tbody>
                  {monthlyRows.map((row, i) => (
                    <React.Fragment key={i}>
                      <tr onClick={() => setExpandedMonth(expandedMonth===row.month ? null : row.month)}
                        style={{ cursor:'pointer', background: expandedMonth===row.month ? 'rgba(255,138,0,0.06)' : 'transparent' }}
                      >
                        <td style={{ fontWeight:700 }}>{row.month}</td>
                        <td>{formatNumber(row.orders)}회</td>
                        <td style={{ color:'var(--accent-neon)' }}>{formatNumber(row.qty)}</td>
                        <td>{row.destList.length}개소</td>
                        <td>{row.itemList.length}종</td>
                        <td style={{ color:'var(--accent-neon)', fontSize:'0.82rem' }}>{expandedMonth===row.month ? '접기 ▲' : '▼'}</td>
                      </tr>
                      {expandedMonth===row.month && (
                        <tr><td colSpan={6} style={{ background:'rgba(255,138,0,0.04)', padding:'14px 20px' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                            <div>
                              <div style={{ color:'var(--text-muted)', fontWeight:600, fontSize:'0.82rem', marginBottom:6 }}>🏢 납품처</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                {row.destList.map((d,j) => <span key={j} style={{ background:'rgba(255,138,0,0.15)', color:'var(--accent-neon)', padding:'3px 10px', borderRadius:999, fontSize:'0.8rem', border:'1px solid rgba(255,138,0,0.3)' }}>{d}</span>)}
                              </div>
                            </div>
                            <div>
                              <div style={{ color:'var(--text-muted)', fontWeight:600, fontSize:'0.82rem', marginBottom:6 }}>📋 출고 품목</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                {row.itemList.map((it,j) => <span key={j} style={{ background:'rgba(56,189,248,0.12)', color:'#38BDF8', padding:'3px 10px', borderRadius:999, fontSize:'0.8rem', border:'1px solid rgba(56,189,248,0.3)' }}>{it}</span>)}
                              </div>
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subTab === 'dest' && (
            <DestDrillDown destRows={destRows} channelDetail={cd} filteredData={filteredData} selectedChannel={selectedChannel} />
          )}

          {subTab === 'item' && (
            <div>
              <div style={{ height: Math.max(itemRows.slice(0,20).length * 36, 300), marginBottom:20 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemRows.slice(0,20).map(it => ({ name:it.name, qty:it.qty }))} layout="vertical" margin={{ top:5, right:30, left:10, bottom:5 }}>
                    <XAxis type="number" stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                    <YAxis dataKey="name" type="category" interval={0} stroke="var(--text-muted)" width={200} tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                    <RechartsTooltip cursor={{fill:'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }} itemStyle={{ color: 'var(--text-main)' }} />
                    <Bar dataKey="qty" name="출고수량" fill="#2DD4BF" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="data-table">
                <thead><tr><th>#</th><th>품목명</th><th>납품 건수</th><th>총 출고량</th></tr></thead>
                <tbody>
                  {itemRows.map((it, i) => (
                    <tr key={i}>
                      <td>{i+1}</td>
                      <td style={{ fontWeight:600 }}>{it.name}</td>
                      <td>{formatNumber(it.orders)}건</td>
                      <td style={{ color:'var(--accent-neon)' }}>{formatNumber(it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Destination Analysis ─────────────────────────────────────────────
function DestTab({ allDestinations, topDestChannels, allChannelNames }) {
  const [sortBy, setSortBy] = useState('qty');
  const sorted = [...allDestinations].sort((a,b) => b[sortBy] - a[sortBy]);

  return (
    <div>
      {/* Stacked Bar */}
      <div className="card" style={{ marginBottom:16 }}>
        <h2 style={{ marginBottom:16 }}>TOP 5 납품처별 배송 채널 분포</h2>
        <div style={{ height:240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDestChannels} layout="vertical" margin={{ top:5, right:30, left:10, bottom:5 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" interval={0} stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} width={160} />
              <RechartsTooltip cursor={{fill:'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }} itemStyle={{ color: 'var(--text-main)' }} />
              <Legend verticalAlign="bottom" wrapperStyle={{ color:'var(--text-main)', fontSize:'0.8rem' }} />
              {allChannelNames.map((ch,i) => <Bar key={ch} dataKey={ch} stackId="a" fill={STACK_COLORS[i%STACK_COLORS.length]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sortable Table */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ margin:0 }}>전체 납품처 목록 ({allDestinations.length}개소)</h2>
          <div style={{ display:'flex', gap:8 }}>
            {[['qty','출고수량순'],['orders','납품횟수순']].map(([id,label]) => (
              <button key={id} onClick={() => setSortBy(id)} style={{
                padding:'6px 14px', fontSize:'0.82rem',
                background: sortBy===id ? 'rgba(255,138,0,0.15)' : 'transparent',
                color: sortBy===id ? 'var(--accent-neon)' : 'var(--text-main)',
                border:'1px solid var(--accent-neon)', borderRadius:8, cursor:'pointer', fontWeight:700, transition:'all 0.2s'
              }}>{label}</button>
            ))}
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>#</th><th>납품처명</th><th>납품 횟수</th><th>총 출고 수량</th></tr></thead>
          <tbody>
            {sorted.map((d,i) => (
              <tr key={i}>
                <td>{i+1}</td>
                <td style={{ fontWeight:600 }}>{d.name}</td>
                <td>{formatNumber(d.orders)}회</td>
                <td style={{ color:'var(--accent-neon)' }}>{formatNumber(d.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 4: Item / SKU Analysis ───────────────────────────────────────────────
function ItemTab({ allItems }) {
    const [viewMode, setViewMode] = useState('table');
  const [filterGrade, setFilterGrade] = useState('전체');
  const [sortField, setSortField] = useState('qty');
  const [sortDesc, setSortDesc] = useState(true);
  const grades = ['전체', 'A등급', 'B등급', 'C등급'];
  const displayed = useMemo(() => {
    let d = filterGrade === '전체' ? [...allItems] : allItems.filter(i => i.category === filterGrade);
    d.sort((a,b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'lastDate') {
        valA = new Date((valA||'').replace(/\./g,'-')).getTime() || 0;
        valB = new Date((valB||'').replace(/\./g,'-')).getTime() || 0;
      }
      return sortDesc ? valB - valA : valA - valB;
    });
    return d;
  }, [allItems, filterGrade, sortField, sortDesc]);

  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ margin:0 }}>품목(SKU) 분석 — ABC 파레토</h2>
        <div style={{ display:'flex', gap:8 }}>
          {/* Grade filter */}
          {grades.map(g => (
            <button key={g} onClick={() => setFilterGrade(g)} style={{
              padding:'6px 14px', fontSize:'0.9rem',
              background: filterGrade===g ? 'rgba(255,138,0,0.15)' : 'transparent',
              color: filterGrade===g ? 'var(--accent-neon)' : 'var(--text-main)',
              border:'1px solid var(--accent-neon)', borderRadius:8, cursor:'pointer', fontWeight:700, transition:'all 0.2s'
            }}>{g}</button>
          ))}
          <span style={{ width:1, background:'var(--card-border)', margin:'0 4px' }}/>
          {/* View toggle */}
          {[['table','표'],['graph','그래프']].map(([id,label]) => (
            <button key={id} onClick={() => setViewMode(id)} style={{
              padding:'6px 14px', fontSize:'0.82rem',
              background: viewMode===id ? 'rgba(255,138,0,0.15)' : 'transparent',
              color: viewMode===id ? 'var(--accent-neon)' : 'var(--text-main)',
              border:'1px solid #38BDF8', borderRadius:8, cursor:'pointer', fontWeight:600, transition:'all 0.2s'
            }}>{label}</button>
          ))}
        </div>
      </div>

      {viewMode === 'graph' ? (
        <div style={{ height: Math.max(displayed.slice(0,50).length * 36, 300) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayed.slice(0,50)} layout="vertical" margin={{ top:5, right:30, left:10, bottom:5 }}>
              <XAxis type="number" stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
              <YAxis dataKey="name" type="category" interval={0} stroke="var(--text-muted)" width={220} tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
              <RechartsTooltip cursor={{fill:'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }} itemStyle={{ color: 'var(--text-main)' }} />
              <Bar dataKey="qty" name="출고수량" radius={[0,4,4,0]}>
                {displayed.slice(0,50).map((item,i) => (
                  <Cell key={i} fill={item.category==='A등급' ? 'var(--accent-neon)' : item.category==='B등급' ? '#38BDF8' : '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>품목명</th><th>ABC 등급</th><th>출고 횟수</th><th>총 출고량</th><th>최종 출고일</th><th>리스크</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, i) => (
                <tr key={i}>
                  <td>{i+1}</td>
                  <td style={{ fontWeight:600 }}>{item.name}</td>
                  <td>
                    <span style={{ color: item.category==='A등급' ? 'var(--accent-neon)' : item.category==='B등급' ? '#38BDF8' : 'var(--text-muted)', fontWeight:700 }}>
                      {item.category}
                    </span>
                  </td>
                  <td>{formatNumber(item.count)}건</td>
                  <td style={{ color:'var(--accent-neon)' }}>{formatNumber(item.qty)}</td>
                  <td>{item.lastDate ? item.lastDate.replace(/\./g,'-') : '-'}</td>
                  <td><span className={`badge ${item.risk.toLowerCase()}`}>{item.risk==='Low' ? '-' : item.risk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DestDrillDown (used inside ChannelTab) ───────────────────────────────────
function DestDrillDown({ destRows, channelDetail, filteredData, selectedChannel }) {
  const [selectedDest, setSelectedDest] = useState(null);
  const weekOrder = ['월', '화', '수', '목', '금', '토', '일'];

  const destDetail = selectedDest ? channelDetail.destDetailMap[selectedDest] : null;
  const monthlyRows = destDetail ? Object.keys(destDetail.monthlyMap).sort().map(m => ({ name:m, ...destDetail.monthlyMap[m] })) : [];
  const weekdayRows = destDetail ? weekOrder.map(d => ({ name:d+'요일', value: destDetail.weekdayMap[d]||0 })) : [];
  const itemRows = destDetail ? Object.values(destDetail.itemMap).sort((a,b) => b.orders-a.orders) : [];

  const lsRawRows = useMemo(() => {
    if (selectedDest !== 'LS' || !filteredData) return [];
    const weekDaysArr = ['일','월','화','수','목','금','토'];
    const groups = {};
    filteredData.filter(d => d.destination==='LS' && d.type===selectedChannel).forEach(d => {
      const date = d.date || '기타';
      if (!groups[date]) {
        let wd = '미상';
        if (d.date) { const p = new Date(d.date.replace(/\./g,'-')); if (!isNaN(p)) wd = weekDaysArr[p.getDay()]+'요일'; }
        groups[date] = { date, weekday:wd, divisions:{} };
      }
      const div = d.division || '기타';
      if (!groups[date].divisions[div]) groups[date].divisions[div] = [];
      const ex = groups[date].divisions[div].find(x => x.name===d.itemName);
      if (ex) ex.qty += d.quantity; else groups[date].divisions[div].push({ name:d.itemName, qty:d.quantity });
    });
    return Object.values(groups).sort((a,b) => b.date.localeCompare(a.date));
  }, [selectedDest, filteredData, selectedChannel]);

  return (
    <div>
      {/* Top bar chart */}
      <div style={{ height: Math.max(destRows.slice(0,15).length * 36, 300), marginBottom:20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={destRows.slice(0,15).map(d => ({ name:d.name, qty:d.qty, orders:d.orders }))} layout="vertical" margin={{ top:5, right:30, left:10, bottom:5 }}>
            <XAxis type="number" stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
            <YAxis dataKey="name" type="category" interval={0} stroke="var(--text-muted)" width={180} tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
            <RechartsTooltip cursor={{fill:'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8 }} itemStyle={{ color: 'var(--text-main)' }} />
            <Bar dataKey="qty" name="출고수량" fill="var(--accent-neon)" radius={[0,4,4,0]} />
            <Bar dataKey="orders" name="납품횟수" fill="#38BDF8" radius={[0,4,4,0]} />
            <Legend wrapperStyle={{ color:'var(--text-main)', fontSize:'0.82rem' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginBottom:12 }}>
        💡 납품처 행을 클릭하면 <strong style={{ color:'var(--accent-neon)' }}>월별 납품 횟수 · 요일 분포 · 출고 품목</strong> 상세를 확인할 수 있습니다.
      </p>
      <table className="data-table">
        <thead><tr><th>#</th><th>납품처</th><th>납품 횟수</th><th>총 출고량</th></tr></thead>
        <tbody>
          {destRows.map((d, idx) => (
            <React.Fragment key={idx}>
              <tr
                onClick={() => setSelectedDest(selectedDest===d.name ? null : d.name)}
                style={{ cursor:'pointer', background: selectedDest===d.name ? 'rgba(255,138,0,0.08)' : 'transparent', borderLeft: selectedDest===d.name ? '3px solid var(--accent-neon)' : '3px solid transparent', transition:'all 0.2s' }}
              >
                <td>{idx+1}</td>
                <td style={{ fontWeight:700, color: selectedDest===d.name ? 'var(--accent-neon)' : 'var(--text-main)' }}>
                  {d.name} {selectedDest===d.name ? '▼' : '▶'}
                </td>
                <td>{formatNumber(d.orders)}회</td>
                <td style={{ color:'var(--accent-neon)' }}>{formatNumber(d.qty)}</td>
              </tr>

              {selectedDest===d.name && (
                <tr><td colSpan={4} style={{ padding:0 }}>
                  <div style={{ background:'rgba(255,138,0,0.03)', border:'1px solid rgba(255,138,0,0.15)', borderRadius:10, margin:'6px 4px 14px', padding:'18px 22px' }}>

                    {selectedDest==='LS' ? (
                      /* LS: Date → Division → Items */
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                          <h3 style={{ color:'var(--accent-neon)', margin:0, fontSize:'0.95rem' }}>📅 LS 직납 일지 (구역별 출고 내역)</h3>
                          <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>총 {lsRawRows.length}회 직납 운행</span>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                          {lsRawRows.map((g, gi) => (
                            <div key={gi} style={{ background:'rgba(255,255,255,0.025)', border:'1px solid var(--card-border)', borderRadius:8, padding:14 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--card-border)', paddingBottom:8, marginBottom:10 }}>
                                <span style={{ fontWeight:700, color:'var(--text-main)' }}>{g.date.replace(/\./g,'-')} <span style={{ color:'#38BDF8', fontWeight:400 }}>({g.weekday})</span></span>
                                <span style={{ color:'var(--accent-neon)', fontWeight:600, fontSize:'0.85rem' }}>총 {formatNumber(Object.values(g.divisions).flat().reduce((s,i) => s+i.qty, 0))}개</span>
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                {Object.entries(g.divisions).map(([div, items]) => (
                                  <div key={div} style={{ paddingLeft:10, borderLeft:'2px solid var(--accent-neon)' }}>
                                    <div style={{ fontWeight:600, color:'var(--accent-neon)', fontSize:'0.82rem', marginBottom:5 }}>📍 LS {div}</div>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                      {items.map((it,ii) => (
                                        <span key={ii} style={{ background:'rgba(56,189,248,0.1)', color:'#38BDF8', padding:'2px 8px', borderRadius:4, fontSize:'0.77rem', border:'1px solid rgba(56,189,248,0.2)' }}>
                                          {it.name}: <strong style={{ color:'var(--text-main)' }}>{formatNumber(it.qty)}개</strong>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : destDetail ? (
                      /* Standard view */
                      <div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:16 }}>
                          {/* Monthly chart */}
                          <div>
                            <div style={{ color:'var(--text-muted)', fontWeight:700, fontSize:'0.82rem', marginBottom:8 }}>📅 월별 납품 횟수</div>
                            <div style={{ height:140 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyRows} margin={{ top:4, right:8, left:-22, bottom:0 }}>
                                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                                  <YAxis stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                                  <RechartsTooltip contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8, fontSize:'0.78rem' }} itemStyle={{ color: 'var(--text-main)' }} />
                                  <Bar dataKey="orders" name="납품횟수" fill="var(--accent-neon)" radius={[3,3,0,0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          {/* Weekday chart */}
                          <div>
                            <div style={{ color:'var(--text-muted)', fontWeight:700, fontSize:'0.82rem', marginBottom:8 }}>📆 요일별 납품 집중도</div>
                            <div style={{ height:140 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weekdayRows} margin={{ top:4, right:8, left:-22, bottom:0 }}>
                                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                                  <YAxis stroke="var(--text-muted)" tick={{fill:'var(--text-main)', fontSize:13, fontWeight:500}} />
                                  <RechartsTooltip contentStyle={{ backgroundColor:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8, fontSize:'0.78rem' }} itemStyle={{ color: 'var(--text-main)' }} />
                                  <Bar dataKey="value" name="납품횟수" fill="#38BDF8" radius={[3,3,0,0]}>
                                    {weekdayRows.map((e,i) => <Cell key={i} fill={e.value===Math.max(...weekdayRows.map(r=>r.value)) ? 'var(--accent-neon)' : '#38BDF8'} />)}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                        {/* Items */}
                        <div style={{ color:'var(--text-muted)', fontWeight:700, fontSize:'0.82rem', marginBottom:8 }}>📦 납품 품목 ({itemRows.length}종)</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {itemRows.map((it,i) => (
                            <span key={i} style={{ background:'rgba(45,212,191,0.1)', color:'#2DD4BF', padding:'4px 10px', borderRadius:999, fontSize:'0.79rem', border:'1px solid rgba(45,212,191,0.25)', display:'flex', alignItems:'center', gap:5 }}>
                              {it.name}
                              <span style={{ background:'rgba(45,212,191,0.2)', padding:'0 6px', borderRadius:999, fontSize:'0.73rem', fontWeight:700 }}>{it.orders}회</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p style={{ color:'var(--text-muted)' }}>데이터가 없습니다.</p>
                    )}

                  </div>
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
