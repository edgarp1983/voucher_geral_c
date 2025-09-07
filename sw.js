// Service Worker para Sistema de Vouchers
const CACHE_NAME = 'vouchers-system-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Erro ao fazer cache:', error);
      })
  );
  
  // Força a ativação imediata
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Ativando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remove caches antigos
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Assume controle imediato de todas as páginas
  self.clients.claim();
});

// Interceptação de requisições (estratégia Cache First)
self.addEventListener('fetch', (event) => {
  // Só intercepta requisições GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Se encontrou no cache, retorna
        if (response) {
          console.log('Service Worker: Servindo do cache:', event.request.url);
          return response;
        }
        
        // Se não encontrou no cache, busca na rede
        console.log('Service Worker: Buscando na rede:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Verifica se a resposta é válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona a resposta para armazenar no cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Erro na requisição:', error);
            
            // Se for uma requisição para HTML e falhou, retorna página offline
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // Para outros recursos, retorna erro
            throw error;
          });
      })
  );
});

// Sincronização em background (para futuras implementações)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Sincronização em background:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aqui poderia implementar sincronização de dados
      Promise.resolve()
    );
  }
});

// Notificações push (para futuras implementações)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Notificação push recebida');
  
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do Sistema de Vouchers',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Abrir Sistema',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Sistema de Vouchers', options)
  );
});

// Clique em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Clique na notificação:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  console.log('Service Worker: Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Responder ao cliente
  event.ports[0].postMessage({
    type: 'SW_RESPONSE',
    message: 'Service Worker ativo e funcionando!'
  });
});

// Tratamento de erros
self.addEventListener('error', (event) => {
  console.error('Service Worker: Erro:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Promise rejeitada:', event.reason);
  event.preventDefault();
});

// Limpeza periódica do cache (executada quando o SW é ativado)
const cleanupCache = async () => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    // Remove entradas antigas (mais de 7 dias)
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime();
          if (responseDate < oneWeekAgo) {
            console.log('Service Worker: Removendo entrada antiga do cache:', request.url);
            await cache.delete(request);
          }
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Erro na limpeza do cache:', error);
  }
};

// Executa limpeza na ativação
self.addEventListener('activate', (event) => {
  event.waitUntil(cleanupCache());
});