/*
  IP Locator — front-end only
  - Validates IPv4 / IPv6
  - Optionally fetches user's own IP
  - Queries a free IP geolocation API
  - Shows a friendly loading status and renders results

  Note: This uses public endpoints that don't require an API key for light usage.
        You can swap providers easily in `fetchIpInfo`.
*/

(function(){
  const form = document.getElementById('lookup-form');
  const input = document.getElementById('ip-input');
  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('status-text');
  const errorEl = document.getElementById('error');

  const resultsEl = document.getElementById('results');
  const copyBtn = document.getElementById('copy-ip');
  const mapLink = document.getElementById('map-link');

  const res = {
    ip: document.getElementById('res-ip'),
    version: document.getElementById('res-version'),
    isp: document.getElementById('res-isp'),
    org: document.getElementById('res-org'),
    asn: document.getElementById('res-asn'),
    country: document.getElementById('res-country'),
    region: document.getElementById('res-region'),
    city: document.getElementById('res-city'),
    postal: document.getElementById('res-postal'),
    lat: document.getElementById('res-lat'),
    lon: document.getElementById('res-lon'),
    tz: document.getElementById('res-tz'),
    utc: document.getElementById('res-utc'),
  };

  const myIpBtn = document.getElementById('myip-btn');

  function showStatus(message){
    statusTextEl.textContent = message || 'Please wait — checking ISP and other details...';
    statusEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
  }

  function hideStatus(){
    statusEl.classList.add('hidden');
  }

  function showError(message){
    errorEl.textContent = message || 'Something went wrong. Please try again.';
    errorEl.classList.remove('hidden');
  }

  function clearError(){
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function isValidIp(ip){
    if(!ip || typeof ip !== 'string') return false;
    const trimmed = ip.trim();
    // Basic IPv4
    const ipv4 = /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/;
    // Basic IPv6 (compressed supported)
    const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){1,7}:)$|^(:(:[0-9a-fA-F]{1,4}){1,7})$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}(:([0-9a-fA-F]{1,4}:){1,6})[0-9a-fA-F]{1,4}$|^::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}\d|)[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}\d|)[0-9])$|^([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}\d|)[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}\d|)[0-9])$/;
    return ipv4.test(trimmed) || ipv6.test(trimmed);
  }

  function getIpVersion(ip){
    if(!ip) return '';
    return ip.includes(':') ? 'IPv6' : 'IPv4';
  }

  async function fetchMyIp(){
    // Try multiple providers for reliability
    const providers = [
      'https://api.ipify.org?format=json',
      'https://ipinfo.io/json',
      'https://ifconfig.co/json',
    ];

    for(const url of providers){
      try{
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if(!res.ok) continue;
        const data = await res.json();
        if(data && data.ip) return data.ip;
        if(data && data.ip_addr) return data.ip_addr; // ifconfig.co
      }catch(_e){/* try next */}
    }
    throw new Error('Unable to determine your IP');
  }

  async function fetchIpInfo(ip){
    // Try several free no-key APIs. Stop on first good response.
    // Only HTTPS endpoints to avoid mixed-content issues when hosted.
    const urls = [
      // ipapi.co
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      // ipwho.is
      `https://ipwho.is/${encodeURIComponent(ip)}`,
    ];

    for(const url of urls){
      try{
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if(!res.ok) continue;
        const data = await res.json();
        const normalized = normalizeResponse(ip, url, data);
        if(normalized) return normalized;
      }catch(_e){/* try next */}
    }
    throw new Error('Lookup failed across providers. Please try again later.');
  }

  function normalizeResponse(ip, url, data){
    try{
      if(url.includes('ipapi.co')){
        if(data.error) return null;
        return {
          ip,
          version: getIpVersion(ip),
          isp: data.org || data.asn_org || data.company || '',
          org: data.org || '',
          asn: data.asn || '',
          country: joinNonEmpty([data.country_name, data.country_code]) || '',
          region: data.region || data.region_code || '',
          city: data.city || '',
          postal: data.postal || '',
          lat: safeNum(data.latitude || data.lat),
          lon: safeNum(data.longitude || data.lon),
          timezone: data.timezone || '',
          utc: data.utc_offset || '',
        };
      }
      if(url.includes('ipwho.is')){
        if(data.success === false) return null;
        return {
          ip,
          version: getIpVersion(ip),
          isp: data.connection && data.connection.isp ? data.connection.isp : (data.connection && data.connection.org ? data.connection.org : ''),
          org: data.connection && data.connection.org ? data.connection.org : '',
          asn: data.connection && data.connection.asn ? `AS${data.connection.asn}` : '',
          country: joinNonEmpty([data.country, data.country_code]) || '',
          region: data.region || '',
          city: data.city || '',
          postal: data.postal || '',
          lat: safeNum(data.latitude),
          lon: safeNum(data.longitude),
          timezone: data.timezone && data.timezone.id ? data.timezone.id : '',
          utc: data.timezone && data.timezone.utc ? data.timezone.utc : '',
        };
      }
      // ip-api.com removed (HTTP-only on free tier)
    }catch(_e){
      return null;
    }
    return null;
  }

  function joinNonEmpty(parts){
    return parts.filter(Boolean).join(' ').trim();
  }

  function safeNum(n){
    const x = Number(n);
    return Number.isFinite(x) ? x : '';
  }

  function renderResults(model){
    if(!model) return;
    resultsEl.classList.remove('hidden');

    res.ip.textContent = model.ip || '';
    res.version.textContent = model.version || '';
    res.isp.textContent = model.isp || '';
    res.org.textContent = model.org || '';
    res.asn.textContent = model.asn || '';
    res.country.textContent = model.country || '';
    res.region.textContent = model.region || '';
    res.city.textContent = model.city || '';
    res.postal.textContent = model.postal || '';
    res.lat.textContent = model.lat !== '' ? String(model.lat) : '';
    res.lon.textContent = model.lon !== '' ? String(model.lon) : '';
    res.tz.textContent = model.timezone || '';
    res.utc.textContent = model.utc || '';

    // set map link
    const lat = model.lat;
    const lon = model.lon;
    if(lat !== '' && lon !== ''){
      mapLink.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lon))}#map=10/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lon))}`;
      mapLink.classList.remove('hidden');
    } else {
      mapLink.href = '#';
      mapLink.classList.add('hidden');
    }
  }

  async function onSubmit(e){
    e.preventDefault();
    clearError();
    const ip = (input.value || '').trim();
    if(!isValidIp(ip)){
      showError('Please enter a valid IPv4 or IPv6 address.');
      return;
    }
    showStatus();
    try{
      const data = await fetchIpInfo(ip);
      hideStatus();
      renderResults(data);
    }catch(err){
      hideStatus();
      showError(err.message || 'Lookup failed.');
    }
  }

  async function onUseMyIp(){
    clearError();
    showStatus('Detecting your IP...');
    try{
      const ip = await fetchMyIp();
      input.value = ip;
      showStatus();
      const data = await fetchIpInfo(ip);
      hideStatus();
      renderResults(data);
    }catch(err){
      hideStatus();
      showError(err.message || 'Could not detect your IP.');
    }
  }

  function onCopyIp(){
    const ip = res.ip.textContent.trim();
    if(!ip) return;
    navigator.clipboard?.writeText(ip).catch(()=>{});
    copyBtn.textContent = 'Copied';
    setTimeout(()=>{ copyBtn.textContent = 'Copy'; }, 1500);
  }

  form.addEventListener('submit', onSubmit);
  myIpBtn.addEventListener('click', onUseMyIp);
  copyBtn.addEventListener('click', onCopyIp);
})();


