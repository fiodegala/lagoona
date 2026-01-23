import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Book, Code, Key, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';

const ApiDocs = () => {
  const API_BASE_URL = 'https://krlnrzwshjwupiklzblz.supabase.co/functions/v1';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const endpoints = [
    {
      method: 'GET',
      path: '/store-products',
      scope: 'products:read',
      description: 'Lista todos os produtos ativos',
      params: 'page, limit, category_id, search',
    },
    {
      method: 'GET',
      path: '/store-products/:id',
      scope: 'products:read',
      description: 'Retorna um produto específico',
    },
    {
      method: 'GET',
      path: '/store-categories',
      scope: 'store:read',
      description: 'Lista todas as categorias',
    },
    {
      method: 'POST',
      path: '/store-orders',
      scope: 'orders:write',
      description: 'Cria um novo pedido',
    },
    {
      method: 'GET',
      path: '/store-orders/:id',
      scope: 'orders:read',
      description: 'Retorna um pedido específico',
    },
    {
      method: 'GET',
      path: '/store-config',
      scope: 'store:read',
      description: 'Retorna configurações públicas da loja',
    },
    {
      method: 'POST',
      path: '/store-webhooks',
      scope: 'webhooks',
      description: 'Recebe webhooks de pagamento',
    },
  ];

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-primary/10 text-primary';
      case 'POST': return 'bg-success/10 text-success';
      case 'PUT': return 'bg-warning/10 text-warning';
      case 'DELETE': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const curlExample = `# Exemplo de requisição autenticada com HMAC

# Variáveis
API_BASE_URL="${API_BASE_URL}"
PUBLIC_KEY="pk_sua_chave_publica"
SECRET_KEY="sk_sua_chave_secreta"
ENDPOINT="/store-products"
METHOD="GET"
TIMESTAMP=$(date +%s)
NONCE=$(uuidgen | tr '[:upper:]' '[:lower:]')
BODY=""  # Vazio para GET

# Calcular body_hash (SHA256 do body)
BODY_HASH=$(echo -n "$BODY" | shasum -a 256 | cut -d' ' -f1)

# Calcular signature (HMAC-SHA256)
PAYLOAD="$METHOD\\n$ENDPOINT\\n$TIMESTAMP\\n$NONCE\\n$BODY_HASH"
# Nota: Use o hash da SECRET_KEY como chave HMAC
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET_KEY_HASH" | cut -d' ' -f2)

# Fazer requisição
curl -X GET "$API_BASE_URL$ENDPOINT" \\
  -H "Content-Type: application/json" \\
  -H "X-Client-Key: $PUBLIC_KEY" \\
  -H "X-Timestamp: $TIMESTAMP" \\
  -H "X-Nonce: $NONCE" \\
  -H "X-Signature: $SIGNATURE"`;

  const jsExample = `// Exemplo em JavaScript/TypeScript (para uso em servidor/backend)

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function callStoreApi(endpoint, method = 'GET', body = null) {
  const API_BASE_URL = '${API_BASE_URL}';
  const PUBLIC_KEY = process.env.PUBLIC_API_KEY;
  const SECRET_KEY_HASH = await sha256(process.env.SECRET_API_KEY);
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyString = body ? JSON.stringify(body) : '';
  const bodyHash = await sha256(bodyString);
  
  // Criar payload para assinatura
  const signaturePayload = \`\${method}\\n\${endpoint}\\n\${timestamp}\\n\${nonce}\\n\${bodyHash}\`;
  const signature = await hmacSha256(SECRET_KEY_HASH, signaturePayload);
  
  const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Key': PUBLIC_KEY,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature,
    },
    body: body ? bodyString : undefined,
  });
  
  return response.json();
}

// Uso
const products = await callStoreApi('/store-products');
console.log(products);

// Criar pedido
const order = await callStoreApi('/store-orders', 'POST', {
  customer_email: 'cliente@email.com',
  customer_name: 'João Silva',
  items: [
    { product_id: 'uuid', name: 'Produto', price: 99.90, quantity: 2 }
  ],
  shipping_address: {
    street: 'Rua Example, 123',
    city: 'São Paulo',
    state: 'SP',
    zip: '01234-567'
  }
});`;

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Book className="h-6 w-6" />
            Documentação da API
          </h1>
          <p className="text-muted-foreground mt-1">
            Guia completo para integrar seu site com a API
          </p>
        </div>

        {/* Base URL */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-3 rounded-lg font-mono text-sm">
                {API_BASE_URL}
              </code>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(API_BASE_URL)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Autenticação HMAC
            </CardTitle>
            <CardDescription>
              Todas as requisições devem incluir os seguintes headers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Key className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <code className="font-semibold">X-Client-Key</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sua PUBLIC_API_KEY (identifica o cliente)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <code className="font-semibold">X-Timestamp</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Unix timestamp em segundos (válido por 5 minutos)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <code className="font-semibold">X-Nonce</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      UUID único para cada requisição (anti-replay)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Key className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <code className="font-semibold">X-Signature</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      HMAC-SHA256 do payload (ver exemplos abaixo)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Fórmula da assinatura:</h4>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`signature = HMAC_SHA256(
  SHA256(SECRET_API_KEY),  // Use o hash da secret como chave
  method + "\\n" + path + "\\n" + timestamp + "\\n" + nonce + "\\n" + SHA256(body)
)`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Endpoints Disponíveis</CardTitle>
            <CardDescription>
              Lista de todos os endpoints da API Store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {endpoints.map((endpoint, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Badge className={`${getMethodColor(endpoint.method)} font-mono w-16 justify-center`}>
                    {endpoint.method}
                  </Badge>
                  <code className="font-mono text-sm flex-1">{endpoint.path}</code>
                  <Badge variant="secondary" className="text-xs">
                    {endpoint.scope}
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden md:block max-w-[200px] truncate">
                    {endpoint.description}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Examples */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Exemplos de Código</CardTitle>
            <CardDescription>
              Copie e adapte para seu projeto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="javascript" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
              </TabsList>
              <TabsContent value="javascript" className="mt-4">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => copyToClipboard(jsExample)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-[500px]">
                    {jsExample}
                  </pre>
                </div>
              </TabsContent>
              <TabsContent value="curl" className="mt-4">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => copyToClipboard(curlExample)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-[500px]">
                    {curlExample}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Important Notes */}
        <Card className="card-elevated border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-warning">⚠️ Importante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Nunca exponha a SECRET_API_KEY no frontend!</strong> Todas as requisições 
              autenticadas devem ser feitas a partir de um servidor (backend, edge function, etc).
            </p>
            <p>
              Se seu site é uma SPA, crie um middleware/API route que recebe a requisição 
              do frontend, assina com as credenciais, e repassa para esta API.
            </p>
            <p>
              Para Next.js, Nuxt, ou SSR: use as variáveis de ambiente no servidor 
              (<code>process.env</code>) e faça as chamadas em Server Components ou API routes.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ApiDocs;
