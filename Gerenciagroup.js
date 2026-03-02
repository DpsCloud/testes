import React, { useState, useEffect } from 'react';

const App = () => {
  // --- Configuração de Login ---
  // Se você tiver um endpoint real de login, informe aqui.
  // Exemplo: const LOGIN_ENDPOINT = 'https://sua.api.com/login';
  const LOGIN_ENDPOINT = '';

  // Estado de autenticação
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authToken, setAuthToken] = React.useState('');
  const [authEmail, setAuthEmail] = React.useState('');
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');

  React.useEffect(() => {
    try {
      const s = localStorage.getItem('session');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && (parsed.token || parsed.email)) {
          setAuthToken(parsed.token || '');
          setAuthEmail(parsed.email || '');
          setIsAuthenticated(true);
        }
      }
    } catch (_) {}
  }, []);

  const getHeaders = (base = {}) => {
    const h = { ...base };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    return h;
  };

  const handleLogin = async () => {
    // Validação rápida
    if (!loginEmail.trim() || !loginPassword.trim()) return showMessage('Informe e-mail e senha.', 'error');

    try {
      if (LOGIN_ENDPOINT && LOGIN_ENDPOINT.trim().length > 0) {
        const resp = await fetch(LOGIN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail.trim(), senha: loginPassword })
        });
        if (!resp.ok) return showMessage('Login inválido. Verifique suas credenciais.', 'error');
        const data = await resp.json().catch(() => ({}));
        const token = data.token || '';
        const email = data.email || loginEmail.trim();
        setAuthToken(token);
        setAuthEmail(email);
        setIsAuthenticated(true);
        localStorage.setItem('session', JSON.stringify({ token, email }));
      } else {
        // Modo somente UI (sem backend): aceita qualquer e-mail/senha não vazios
        setAuthToken('');
        setAuthEmail(loginEmail.trim());
        setIsAuthenticated(true);
        localStorage.setItem('session', JSON.stringify({ token: '', email: loginEmail.trim() }));
      }
      showMessage('Login realizado com sucesso!', 'success');
    } catch (e) {
      console.error('Erro de login:', e);
      showMessage('Falha ao conectar no serviço de login.', 'error');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthToken('');
    setAuthEmail('');
    setLoginEmail('');
    setLoginPassword('');
    localStorage.removeItem('session');
  };
  const [step, setStep] = useState(1);
  const [action, setAction] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState({ add: '', remove: '', substituteFrom: '', substituteTo: '', update: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [confirmSelection, setConfirmSelection] = useState(false);

  // Helper para obter chave única do grupo (fallback quando não há id_grupo)
  const groupKey = (g) => (
    g?.['id_grupo'] ?? g?.['id'] ?? g?.['idGrupo'] ?? g?.id ?? g?.['nome grupo'] ?? JSON.stringify(g)
  );

  // --- Normalização dos telefones com DDD '55' ---
  const formatPhoneNumber = (n) => {
    const d = (n || '').replace(/\D/g, '');
    return d ? (d.startsWith('55') ? d : '55' + d) : '';
  };
  const parsePhoneList = (text) => (text || '')
    .split(/[\n,;]+|\s+/)
    .map(t => {
      const d = t.replace(/\D/g, '');
      return d ? (d.startsWith('55') ? d : '55' + d) : '';
    })
    .filter(n => n.length > 0);

  const formatPhoneDisplay = (number) => {
    if (!number) return '';
    const d = number.replace(/\D/g, '');
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
  };

  const handlePhoneChange = (field, value) => {
    if (field === 'substituteFrom' || field === 'substituteTo') {
      setPhoneNumbers(p => ({ ...p, [field]: value.replace(/\D/g, '') }));
    } else {
      setPhoneNumbers(p => ({ ...p, [field]: value }));
    }
  };

  const handleActionSelect = (a) => { setAction(a); setStep(2); setConfirmSelection(false); };

  const handleNextToGroups = () => {
    if (action === 'adicionar' && parsePhoneList(phoneNumbers.add).length === 0) return showMessage('Por favor, digite ao menos um número para adicionar.', 'error');
    if (action === 'remover' && parsePhoneList(phoneNumbers.remove).length === 0) return showMessage('Por favor, digite ao menos um número para remover.', 'error');
    if (action === 'substituir' && (!phoneNumbers.substituteFrom || !phoneNumbers.substituteTo)) return showMessage('Por favor, digite ambos os números para substituir.', 'error');
    if (action === 'atualizar' && parsePhoneList(phoneNumbers.update).length === 0) return showMessage('Por favor, digite ao menos um número para atualizar.', 'error');
    setStep(3); setConfirmSelection(false);
  };

  const searchGroups = async (searchTerm) => {
    if (!searchTerm.trim()) { setGroups([]); return; }
    setLoading(true);
    try {
      const response = await fetch('https://webhook.starlabz.com.br/webhook/b3dc5466-15ef-4981-819d-97822502ef1a', {
        method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ termo_busca: searchTerm })
      });

      if (!response.ok) {
        console.warn('Busca de grupos falhou:', response.status, response.statusText);
      }

      const raw = await response.text();
      let data = [];
      if (raw && raw.trim().length > 0) {
        try {
          data = JSON.parse(raw);
        } catch (parseErr) {
          console.warn('Resposta não é JSON válido:', parseErr);
          data = [];
        }
      }

      const groupsData = Array.isArray(data) ? data : [];
      const s = searchTerm.toLowerCase();
      const filtered = groupsData.filter(g => (g['nome grupo']||'').toLowerCase().includes(s));
      setGroups(filtered);
    } catch (e) {
      console.error('Erro ao buscar grupos:', e);
      // Não quebrar UI caso servidor retorne corpo vazio
      setGroups([]);
      showMessage('Não foi possível buscar grupos agora. Tente novamente mais tarde.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(() => searchGroups(groupName), 300); return () => clearTimeout(t); }, [groupName]);

  const handleGroupToggle = (group) => {
    const id = groupKey(group);
    setSelectedGroups(prev => {
      const isSel = prev.some(g => groupKey(g) === id);
      const next = isSel ? prev.filter(g => groupKey(g) !== id) : [...prev, group];
      return next;
    });
    setConfirmSelection(false);
  };

  const handleSelectAll = () => {
    const allSelected = groups.every(g => selectedGroups.some(sg => groupKey(sg) === groupKey(g)));
    if (allSelected) {
      setSelectedGroups(prev => prev.filter(sg => !groups.some(g => groupKey(g) === groupKey(sg))));
    } else {
      setSelectedGroups(prev => {
        const newSelected = [...prev];
        groups.forEach(g => {
          if (!newSelected.some(sg => groupKey(sg) === groupKey(g))) {
            newSelected.push(g);
          }
        });
        return newSelected;
      });
    }
    setConfirmSelection(false);
  };

  const handleSubmit = async () => {
    if (selectedGroups.length === 0) return showMessage('Por favor, selecione pelo menos um grupo.', 'error');
    if (!confirmSelection) return showMessage('Confirme a seleção dos grupos antes de enviar.', 'error');

    // Unificar todos os casos em um único campo 'telefone', já prefixados com '55'
    let telefone = [];
    if (action === 'adicionar') telefone = parsePhoneList(phoneNumbers.add);
    else if (action === 'remover') telefone = parsePhoneList(phoneNumbers.remove);
    else if (action === 'atualizar') telefone = parsePhoneList(phoneNumbers.update);
    else if (action === 'substituir') telefone = [formatPhoneNumber(phoneNumbers.substituteFrom), formatPhoneNumber(phoneNumbers.substituteTo)].filter(Boolean);

    const payload = { grupos_selecionados: selectedGroups, acao: action, sera_admin: isAdmin, telefone };

    try {
      const response = await fetch('https://webhook.starlabz.com.br/webhook/6c8fce36-3430-4614-9e61-9e5b08497528', {
        method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload)
      });
      if (response.ok) {
        showMessage('Dados enviados com sucesso!', 'success');
        setStep(1); setAction(''); setPhoneNumbers({ add: '', remove: '', substituteFrom: '', substituteTo: '', update: '' }); setIsAdmin(false); setGroupName(''); setGroups([]); setSelectedGroups([]); setConfirmSelection(false);
      } else showMessage('Erro ao enviar os dados. Tente novamente.', 'error');
    } catch (e) {
      console.error('Erro de envio:', e);
      showMessage('Erro de conexão. Verifique sua internet e tente novamente.', 'error');
    }
  };

  const showMessage = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 5000); };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex justify-center items-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 sm:p-8">
          <h1 className="text-center text-gray-800 text-xl sm:text-2xl font-semibold mb-6">Entrar</h1>
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-gray-600 font-medium">E-mail</label>
              <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="seu@email.com" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block mb-2 text-gray-600 font-medium">Senha</label>
              <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <button onClick={handleLogin} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Entrar</button>
            {LOGIN_ENDPOINT ? (
              <p className="text-sm text-gray-500 text-center">Conectando ao serviço de login configurado.</p>
            ) : (
              <p className="text-sm text-gray-500 text-center">Login apenas visual (sem validação no servidor).</p>
            )}
          </div>
          {message.text && (
            <div className={`mt-6 p-3 rounded-lg text-center font-medium ${message.type==='success'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{message.text}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-gray-800 text-lg sm:text-xl font-semibold">Gerenciamento de Grupos WhatsApp</h1>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">{authEmail ? `Logado como ${authEmail}` : 'Sessão ativa'}</span>
            <button onClick={handleLogout} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded">Sair</button>
          </div>
        </div>
        
        <div className="flex justify-center mb-6"><div className="flex space-x-2">{[1,2,3].map(num => (<div key={num} className={`w-3 h-3 rounded-full ${step>=num?'bg-indigo-500':'bg-gray-300'}`}/>))}</div></div>

        
        <div className="flex justify-center mb-6"><div className="flex space-x-2">{[1,2,3].map(num => (<div key={num} className={`w-3 h-3 rounded-full ${step>=num?'bg-indigo-500':'bg-gray-300'}`}/>))}</div></div>

        {step===1 && (
          <div className="space-y-4">
            <p className="text-center text-gray-600 mb-6">Selecione a ação que deseja realizar:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[{value:'adicionar',label:'Adicionar pessoas'},{value:'remover',label:'Remover pessoas'},{value:'substituir',label:'Substituir pessoas'},{value:'atualizar',label:'Atualizar funções'}].map(opt => (
                <button key={opt.value} onClick={() => handleActionSelect(opt.value)} className="p-4 border-2 border-gray-200 rounded-lg text-gray-700 font-medium hover:border-indigo-300 hover:bg-indigo-50 transition-colors">{opt.label}</button>
              ))}
            </div>
          </div>
        )}

        {step===2 && (
          <div className="space-y-6">
            <button onClick={() => setStep(1)} className="text-indigo-600 font-medium mb-4 flex items-center">← Voltar</button>
            {action==='adicionar' && (
              <div>
                <label className="block mb-2 text-gray-600 font-medium">Números de telefone para adicionar (com DDD):</label>
                <textarea value={phoneNumbers.add} onChange={e=>handlePhoneChange('add',e.target.value)} placeholder="Cole um ou mais números com DDD, um por linha" rows={4} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors"/>
                <p className="text-sm text-gray-500 mt-1">Os números serão enviados sem traços, pontos ou espaços.</p>
                <label className="flex items-center cursor-pointer mt-3"><input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} className="mr-3 h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"/><span className="text-gray-600">Essas pessoas serão admin?</span></label>
              </div>
            )}
            {action==='remover' && (
              <div>
                <label className="block mb-2 text-gray-600 font-medium">Números de telefone para remover (com DDD):</label>
                <textarea value={phoneNumbers.remove} onChange={e=>handlePhoneChange('remove',e.target.value)} placeholder="Cole um ou mais números com DDD, um por linha" rows={4} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors"/>
                <p className="text-sm text-gray-500 mt-1">Os números serão enviados sem traços, pontos ou espaços.</p>
              </div>
            )}
            {action==='substituir' && (
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-gray-600 font-medium">Número de quem vai sair (com DDD):</label>
                  <input type="tel" value={formatPhoneDisplay(phoneNumbers.substituteFrom)} onChange={e=>handlePhoneChange('substituteFrom',e.target.value)} placeholder="(00) 00000-0000" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors"/>
                </div>
                <div>
                  <label className="block mb-2 text-gray-600 font-medium">Número de quem vai entrar (com DDD):</label>
                  <input type="tel" value={formatPhoneDisplay(phoneNumbers.substituteTo)} onChange={e=>handlePhoneChange('substituteTo',e.target.value)} placeholder="(00) 00000-0000" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors"/>
                </div>
                <label className="flex items-center cursor-pointer"><input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} className="mr-3 h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"/><span className="text-gray-600">Essa pessoa (que entra) será admin?</span></label>
              </div>
            )}
            {action==='atualizar' && (
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-gray-600 font-medium">Números de telefone para atualizar (com DDD):</label>
                  <textarea value={phoneNumbers.update} onChange={e=>handlePhoneChange('update',e.target.value)} placeholder="Cole um ou mais números com DDD, um por linha" rows={4} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors"/>
                  <p className="text-sm text-gray-500 mt-1">Os números serão enviados sem traços, pontos ou espaços.</p>
                </div>
                <label className="flex items-center cursor-pointer"><input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} className="mr-3 h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"/><span className="text-gray-600">Essas pessoas serão admin?</span></label>
              </div>
            )}
            <button onClick={handleNextToGroups} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors mt-4">Próximo: Selecionar Grupos</button>
          </div>
        )}

        {step===3 && (
          <div className="space-y-6">
            <button onClick={() => setStep(2)} className="text-indigo-600 font-medium mb-4 flex items-center">← Voltar</button>
            <div>
              <label htmlFor="groupName" className="block mb-2 text-gray-600 font-medium">Buscar grupo por nome:</label>
              <input type="text" id="groupName" value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Digite parte do nome do grupo" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-indigo-500 transition-colors"/>
            </div>
            {loading && (<div className="text-center py-4 text-gray-600">Buscando grupos...</div>)}
            {groups.length>0 && (
              <div className="max-h-60 overflow-y-auto border-2 border-gray-200 rounded-lg bg-gray-50 p-3">
                <label className="flex items-center py-2 border-b-2 border-gray-300 mb-2 cursor-pointer hover:bg-gray-100 rounded px-2 -mx-2">
                  <input 
                    type="checkbox" 
                    checked={groups.length > 0 && groups.every(g => selectedGroups.some(sg => groupKey(sg) === groupKey(g)))}
                    onChange={handleSelectAll}
                    className="mr-3 h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="font-semibold text-gray-800 select-none">
                    {groups.length > 0 && groups.every(g => selectedGroups.some(sg => groupKey(sg) === groupKey(g))) 
                      ? `Desmarcar todos os ${groups.length} grupos` 
                      : `Selecionar todos os ${groups.length} grupos`}
                  </div>
                </label>
                {groups.map(group => (
                  <div key={`group-${groupKey(group)}`} className="flex items-center py-2 border-b border-gray-200 last:border-b-0">
                    <input type="checkbox" id={`group-${groupKey(group)}`} checked={selectedGroups.some(g=>groupKey(g)===groupKey(group))} onChange={()=>handleGroupToggle(group)} className="mr-3 h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"/>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{group['nome grupo']}</div>
                      <div className="text-sm text-gray-600">{group['Quantidade']} membros</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedGroups.length>0 && (
              <div className="border-2 border-indigo-200 rounded-lg bg-indigo-50 p-3">
                <div className="font-semibold text-indigo-700 mb-2">Grupos selecionados ({selectedGroups.length})</div>
                <div className="space-y-2">
                  {selectedGroups.map(g => (
                    <div key={`sel-${groupKey(g)}`} className="flex items-center justify-between bg-white rounded-lg p-2 border border-indigo-200">
                      <div className="flex-1">
                        <span className="text-indigo-800 font-medium">{g['nome grupo']}</span>
                        <span className="text-indigo-600 text-sm ml-2">• {g['Quantidade']} membros</span>
                      </div>
                      <button 
                        onClick={() => handleGroupToggle(g)}
                        className="ml-2 w-6 h-6 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                        title="Remover grupo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <label className="flex items-center mt-3 cursor-pointer">
                  <input type="checkbox" className="mr-2 h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500" checked={confirmSelection} onChange={e=>setConfirmSelection(e.target.checked)} />
                  <span className="text-indigo-700">Confirmo a seleção destes grupos</span>
                </label>
              </div>
            )}

            {groups.length===0 && groupName.trim() && !loading && (<div className="text-center py-4 text-gray-600">Nenhum grupo encontrado com "{groupName}"</div>)}
            <button onClick={handleSubmit} disabled={selectedGroups.length===0 || !confirmSelection} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">Enviar</button>
          </div>
        )}

        {message.text && (
          <div className={`mt-6 p-3 rounded-lg text-center font-medium ${message.type==='success'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{message.text}</div>
        )}
      </div>
    </div>
  );
};

export default App;