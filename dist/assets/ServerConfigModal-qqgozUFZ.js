import{c as x,b as u,r as c,f as m,j as e,s as h}from"./index-B0i-pAQC.js";const v=()=>u.isNativePlatform(),b=async(l,s=5e3)=>{const o=l.trim().replace(/\/$/,"");if(v()){const r=await x.get({url:`${o}/api/health`,connectTimeout:s,readTimeout:s});return{ok:r.status>=200&&r.status<300,status:r.status}}const i=new AbortController,a=window.setTimeout(()=>i.abort(),s);try{const r=await fetch(`${o}/api/health`,{method:"GET",signal:i.signal});return{ok:r.ok,status:r.status}}finally{window.clearTimeout(a)}},w=({onSubmit:l,isVisible:s})=>{const[o,i]=c.useState(""),[a,r]=c.useState(""),[d,p]=c.useState(!1);c.useEffect(()=>{const t=m();t&&i(t)},[]);const f=t=>{try{const n=new URL(t);return n.protocol==="http:"||n.protocol==="https:"}catch{return!1}},g=async t=>{if(t.preventDefault(),r(""),!o.trim()){r("Пожалуйста, введите адрес сервера");return}if(!f(o)){r("Неверный формат URL (используйте http:// или https://)");return}p(!0);try{if(!(await b(o,5e3).catch(()=>{throw new Error("Не удается подключиться к серверу")})).ok)throw new Error("Сервер недоступен");h(o),console.log("[Config] Server URL saved:",o),l(o)}catch(n){console.error("[Config] Connection test failed:",n),r("Ошибка подключения. Проверьте адрес сервера и попробуйте снова.")}finally{p(!1)}};return s?e.jsxs("div",{className:"server-config-modal",children:[e.jsx("div",{className:"server-config-overlay"}),e.jsx("div",{className:"server-config-container",children:e.jsxs("div",{className:"server-config-content",children:[e.jsx("h1",{children:"⚙️ Настройка сервера"}),e.jsx("p",{className:"server-config-description",children:"Введите адрес вашего NEXA сервера для подключения"}),e.jsxs("form",{onSubmit:g,children:[e.jsxs("div",{className:"server-config-input-group",children:[e.jsx("label",{htmlFor:"serverUrl",children:"Адрес сервера:"}),e.jsx("input",{id:"serverUrl",type:"url",value:o,onChange:t=>{i(t.target.value),r("")},placeholder:"https://your-server.com",disabled:d,className:"server-config-input"}),e.jsx("small",{children:"Пример: http://192.168.1.100:3000"}),e.jsx("small",{children:"или https://nexa.example.com"})]}),a&&e.jsx("div",{className:"server-config-error",children:e.jsxs("span",{children:["❌ ",a]})}),e.jsx("button",{type:"submit",disabled:d||!o.trim(),className:"server-config-submit",children:d?"⏳ Проверка подключения...":"✅ Подключиться"})]}),e.jsxs("div",{className:"server-config-tips",children:[e.jsx("h3",{children:"💡 Советы:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Используйте IP адрес если сервер локальный (например, 192.168.1.100:3000)"}),e.jsx("li",{children:"Для удаленного сервера используйте доменное имя (example.com)"}),e.jsx("li",{children:"Убедитесь что порт открыт и доступен"}),e.jsx("li",{children:"Адрес будет сохранен для последующих запусков"})]})]})]})}),e.jsx("style",{children:`
        .server-config-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
        }

        .server-config-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .server-config-container {
          position: relative;
          z-index: 1;
          width: 90%;
          max-width: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 30px;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .server-config-content h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
          color: #333;
        }

        .server-config-description {
          margin: 0 0 20px 0;
          color: #666;
          font-size: 14px;
        }

        .server-config-input-group {
          margin-bottom: 20px;
        }

        .server-config-input-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .server-config-input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          font-family: monospace;
          transition: border-color 0.3s;
          box-sizing: border-box;
        }

        .server-config-input:focus {
          outline: none;
          border-color: #007AFF;
          background: #f9f9f9;
        }

        .server-config-input:disabled {
          background: #f5f5f5;
          color: #999;
        }

        .server-config-input-group small {
          display: block;
          margin-top: 6px;
          color: #999;
          font-size: 12px;
        }

        .server-config-error {
          padding: 12px;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 6px;
          color: #c33;
          margin-bottom: 15px;
          font-size: 13px;
        }

        .server-config-submit {
          width: 100%;
          padding: 12px;
          background: #007AFF;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s;
          margin-bottom: 20px;
        }

        .server-config-submit:hover:not(:disabled) {
          background: #0051D5;
        }

        .server-config-submit:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .server-config-tips {
          background: #f0f8ff;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #007AFF;
        }

        .server-config-tips h3 {
          margin: 0 0 10px 0;
          font-size: 13px;
          color: #0051D5;
        }

        .server-config-tips ul {
          margin: 0;
          padding-left: 20px;
          font-size: 12px;
          color: #666;
        }

        .server-config-tips li {
          margin-bottom: 6px;
        }

        /* Mobile optimizations */
        @media (max-width: 600px) {
          .server-config-container {
            width: 95%;
            padding: 20px;
          }

          .server-config-content h1 {
            font-size: 20px;
          }
        }
      `})]}):null};export{w as ServerConfigModal,w as default};
