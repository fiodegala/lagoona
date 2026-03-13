import StoreLayout from '@/components/store/StoreLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Database, Key, Shield, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const ApiImportDocsPage = () => {
  const API_URL = 'https://krlnrzwshjwupiklzblz.supabase.co/functions/v1/api-import';

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const pythonScript = `import hashlib, hmac, uuid, time, json, requests

API_URL = "${API_URL}"
PUBLIC_KEY = "pk_sua_chave"
SECRET_KEY = "sk_sua_chave"

def sign_request(method, path, body_str):
    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    body_hash = hashlib.sha256(body_str.encode()).hexdigest()
    secret_hash = hashlib.sha256(SECRET_KEY.encode()).hexdigest()
    payload = f"{method}\\n{path}\\n{timestamp}\\n{nonce}\\n{body_hash}"
    signature = hmac.new(
        secret_hash.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-Client-Key": PUBLIC_KEY,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
    }

# Seus dados retroativos do Power BI
vendas = [
    {
        "cliente": "Maria Silva",
        "valor_total": 259.90,
        "forma_pagamento": "pix",
        "tipo_venda": "varejo",
        "data": "2024-01-15T14:30:00Z",
        "itens": [
            {"name": "Camisa ML Branca", "price": 129.95, "quantity": 2}
        ]
    },
]

# Enviar em lotes de 500
BATCH = 500
for i in range(0, len(vendas), BATCH):
    batch = vendas[i:i+BATCH]
    body = json.dumps({"type": "sales", "records": batch})
    headers = sign_request("POST", "/api-import", body)
    resp = requests.post(API_URL, headers=headers, data=body)
    result = resp.json()
    print(f"Lote {i//BATCH + 1}: {result.get('inserted', 0)} inseridos")`;

  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <Database className="h-4 w-4" />
            Documentação da API de Importação
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Importar Dados do Power BI
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Guia completo para importar dados retroativos de Clientes, Vendas e Pedidos via API REST.
          </p>
        </div>

        {/* Pré-requisitos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              1. Pré-requisitos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <p>Crie uma <strong>API Key</strong> no painel Admin → Chaves de API</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <p>Marque o escopo <Badge variant="secondary">import:write</Badge></p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <p>Guarde a <code className="bg-muted px-1.5 py-0.5 rounded text-xs">PUBLIC_KEY</code> e <code className="bg-muted px-1.5 py-0.5 rounded text-xs">SECRET_KEY</code> (exibida apenas uma vez)</p>
            </div>
          </CardContent>
        </Card>

        {/* Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              2. Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-600 font-mono">POST</Badge>
              <code className="flex-1 bg-muted p-3 rounded-lg font-mono text-xs break-all">
                {API_URL}
              </code>
              <Button variant="outline" size="icon" onClick={() => copy(API_URL)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Headers obrigatórios (HMAC):</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Header</th>
                      <th className="text-left py-2 font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b"><td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">X-Client-Key</code></td><td className="py-2">Sua PUBLIC_KEY</td></tr>
                    <tr className="border-b"><td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">X-Timestamp</code></td><td className="py-2">Unix timestamp em segundos</td></tr>
                    <tr className="border-b"><td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">X-Nonce</code></td><td className="py-2">UUID único por requisição</td></tr>
                    <tr><td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">X-Signature</code></td><td className="py-2">HMAC-SHA256 do payload</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Fórmula da assinatura:</h4>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{`signature = HMAC_SHA256(
  SHA256(SECRET_KEY),
  method + "\\n" + path + "\\n" + timestamp + "\\n" + nonce + "\\n" + SHA256(body)
)`}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Body */}
        <Card>
          <CardHeader>
            <CardTitle>3. Formato do Body</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">{`{
  "type": "customers | sales | orders",
  "records": [ ... ]  // máx 500 por requisição
}`}</pre>
          </CardContent>
        </Card>

        {/* Campos - Clientes */}
        <Card>
          <CardHeader>
            <CardTitle>4a. Clientes <Badge variant="secondary" className="ml-2">type: "customers"</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 pr-4">Campo</th><th className="text-left py-2 pr-4">Alt. PT</th><th className="text-left py-2">Obrigatório</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">name</code></td><td className="py-1.5"><code className="text-xs">nome</code></td><td className="py-1.5">Sim</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">email</code></td><td className="py-1.5">—</td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">phone</code></td><td className="py-1.5"><code className="text-xs">telefone</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">document</code></td><td className="py-1.5"><code className="text-xs">cpf, cnpj, documento</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">customer_type</code></td><td className="py-1.5"><code className="text-xs">tipo</code></td><td className="py-1.5">Não (default: fisica)</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">address</code></td><td className="py-1.5"><code className="text-xs">endereco</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">city</code></td><td className="py-1.5"><code className="text-xs">cidade</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">state</code></td><td className="py-1.5"><code className="text-xs">estado</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">zip_code</code></td><td className="py-1.5"><code className="text-xs">cep</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">neighborhood</code></td><td className="py-1.5"><code className="text-xs">bairro</code></td><td className="py-1.5">Não</td></tr>
                  <tr><td className="py-1.5"><code className="text-xs">notes</code></td><td className="py-1.5"><code className="text-xs">observacoes</code></td><td className="py-1.5">Não</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Campos - Vendas */}
        <Card>
          <CardHeader>
            <CardTitle>4b. Vendas PDV <Badge variant="secondary" className="ml-2">type: "sales"</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 pr-4">Campo</th><th className="text-left py-2 pr-4">Alt. PT</th><th className="text-left py-2">Obrigatório</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">customer_name</code></td><td className="py-1.5"><code className="text-xs">cliente</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">customer_document</code></td><td className="py-1.5"><code className="text-xs">cpf_cliente</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">items</code></td><td className="py-1.5"><code className="text-xs">itens</code></td><td className="py-1.5">Não (default: [])</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">subtotal</code></td><td className="py-1.5"><code className="text-xs">valor</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">total</code></td><td className="py-1.5"><code className="text-xs">valor_total</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">discount_amount</code></td><td className="py-1.5"><code className="text-xs">desconto</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">payment_method</code></td><td className="py-1.5"><code className="text-xs">forma_pagamento</code></td><td className="py-1.5">Não (default: dinheiro)</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">sale_type</code></td><td className="py-1.5"><code className="text-xs">tipo_venda</code></td><td className="py-1.5">Não (default: varejo)</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">notes</code></td><td className="py-1.5"><code className="text-xs">observacoes</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b bg-primary/5"><td className="py-1.5 font-semibold"><code className="text-xs">created_at</code></td><td className="py-1.5"><code className="text-xs font-semibold">data</code></td><td className="py-1.5 font-semibold text-primary">⚠️ Sim (retroativo!)</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Campos - Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>4c. Pedidos Online <Badge variant="secondary" className="ml-2">type: "orders"</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 pr-4">Campo</th><th className="text-left py-2 pr-4">Alt. PT</th><th className="text-left py-2">Obrigatório</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">customer_email</code></td><td className="py-1.5"><code className="text-xs">email</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">customer_name</code></td><td className="py-1.5"><code className="text-xs">cliente</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">items</code></td><td className="py-1.5"><code className="text-xs">itens</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">total</code></td><td className="py-1.5"><code className="text-xs">valor_total</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">status</code></td><td className="py-1.5">—</td><td className="py-1.5">Não (default: delivered)</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">payment_method</code></td><td className="py-1.5"><code className="text-xs">forma_pagamento</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">payment_status</code></td><td className="py-1.5"><code className="text-xs">status_pagamento</code></td><td className="py-1.5">Não (default: paid)</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">shipping_address</code></td><td className="py-1.5"><code className="text-xs">endereco_entrega</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b"><td className="py-1.5"><code className="text-xs">external_id</code></td><td className="py-1.5"><code className="text-xs">id_externo</code></td><td className="py-1.5">Não</td></tr>
                  <tr className="border-b bg-primary/5"><td className="py-1.5 font-semibold"><code className="text-xs">created_at</code></td><td className="py-1.5"><code className="text-xs font-semibold">data</code></td><td className="py-1.5 font-semibold text-primary">⚠️ Sim (retroativo!)</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Script Python */}
        <Card>
          <CardHeader>
            <CardTitle>5. Script Python (Power BI → API)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 z-10"
                onClick={() => copy(pythonScript)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-[500px]">
                {pythonScript}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Resposta */}
        <Card>
          <CardHeader>
            <CardTitle>6. Resposta da API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" /> Sucesso total (200):
              </h4>
              <pre className="bg-muted p-3 rounded-lg text-xs">{`{
  "success": true,
  "type": "sales",
  "inserted": 500,
  "total_sent": 500
}`}</pre>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" /> Sucesso parcial (207):
              </h4>
              <pre className="bg-muted p-3 rounded-lg text-xs">{`{
  "success": true,
  "type": "sales",
  "inserted": 480,
  "total_sent": 500,
  "errors": ["Lote 5: duplicate key value..."]
}`}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Onde aparece */}
        <Card>
          <CardHeader>
            <CardTitle>7. Onde os Dados Aparecem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 pr-4">Tipo</th><th className="text-left py-2">Página no Admin</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2">Clientes</td><td className="py-2"><code className="text-xs">/admin/customers</code></td></tr>
                  <tr className="border-b"><td className="py-2">Vendas PDV</td><td className="py-2"><code className="text-xs">/admin/sales</code>, Dashboard, Relatórios</td></tr>
                  <tr><td className="py-2">Pedidos Online</td><td className="py-2"><code className="text-xs">/admin/orders</code>, Dashboard, Relatórios</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Avisos */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <Shield className="h-5 w-5" />
              Avisos Importantes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>⚠️ Dados retroativos:</strong> Sempre envie o campo <code className="bg-muted px-1 rounded text-xs">created_at</code> (ou <code className="bg-muted px-1 rounded text-xs">data</code>) com a data original. Caso contrário, será usada a data atual.
            </p>
            <p>
              <strong>🔒 Segurança:</strong> Nunca exponha a SECRET_KEY no frontend. Execute o script em ambiente seguro (servidor, máquina local, etc).
            </p>
            <p>
              <strong>📦 Lotes:</strong> Máximo de 500 registros por requisição. Para volumes maiores, envie em múltiplas requisições.
            </p>
          </CardContent>
        </Card>

        {/* Fluxo recomendado */}
        <Card>
          <CardHeader>
            <CardTitle>8. Fluxo Recomendado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                'Exporte os dados do Power BI como CSV ou conecte via Python',
                'Mapeie as colunas para os campos aceitos pela API',
                'Execute o script Python em lotes de 500 registros',
                'Verifique no Dashboard se os dados retroativos aparecem nos gráficos',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
};

export default ApiImportDocsPage;
