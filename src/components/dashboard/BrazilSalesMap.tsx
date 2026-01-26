import { useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Brazil TopoJSON URL
const BRAZIL_TOPO_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';

// Brazilian state codes mapping
const stateNames: Record<string, string> = {
  'AC': 'Acre',
  'AL': 'Alagoas',
  'AP': 'Amapá',
  'AM': 'Amazonas',
  'BA': 'Bahia',
  'CE': 'Ceará',
  'DF': 'Distrito Federal',
  'ES': 'Espírito Santo',
  'GO': 'Goiás',
  'MA': 'Maranhão',
  'MT': 'Mato Grosso',
  'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais',
  'PA': 'Pará',
  'PB': 'Paraíba',
  'PR': 'Paraná',
  'PE': 'Pernambuco',
  'PI': 'Piauí',
  'RJ': 'Rio de Janeiro',
  'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia',
  'RR': 'Roraima',
  'SC': 'Santa Catarina',
  'SP': 'São Paulo',
  'SE': 'Sergipe',
  'TO': 'Tocantins',
};

interface SalesByState {
  [stateCode: string]: {
    total: number;
    count: number;
    cities: {
      [city: string]: {
        total: number;
        count: number;
      };
    };
  };
}

interface BrazilSalesMapProps {
  salesByState: SalesByState;
  isLoading?: boolean;
}

const BrazilSalesMap = ({ salesByState, isLoading }: BrazilSalesMapProps) => {
  const [tooltipContent, setTooltipContent] = useState('');
  const [position, setPosition] = useState({ coordinates: [-55, -15] as [number, number], zoom: 1 });
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const { maxSales, colorScale } = useMemo(() => {
    const values = Object.values(salesByState).map((s) => s.total);
    const max = Math.max(...values, 1);
    
    const getColor = (value: number) => {
      if (value === 0) return 'hsl(var(--muted))';
      const intensity = Math.min(value / max, 1);
      // Use primary color with varying opacity
      const hue = 221; // Primary blue hue
      const saturation = 83;
      const lightness = Math.round(70 - intensity * 35); // Darker = more sales
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };
    
    return { maxSales: max, colorScale: getColor };
  }, [salesByState]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleZoomIn = () => {
    if (position.zoom >= 4) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom * 1.5 }));
  };

  const handleZoomOut = () => {
    if (position.zoom <= 0.5) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom / 1.5 }));
  };

  const handleReset = () => {
    setPosition({ coordinates: [-55, -15] as [number, number], zoom: 1 });
    setSelectedState(null);
  };

  const handleMoveEnd = (pos: { coordinates: [number, number]; zoom: number }) => {
    setPosition(pos);
  };

  // Get top states by sales
  const topStates = useMemo(() => {
    return Object.entries(salesByState)
      .filter(([, data]) => data.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
  }, [salesByState]);

  // Get cities for selected state
  const selectedStateCities = useMemo(() => {
    if (!selectedState || !salesByState[selectedState]) return [];
    const cities = salesByState[selectedState].cities;
    return Object.entries(cities)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);
  }, [selectedState, salesByState]);

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Vendas por Região
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando mapa...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Vendas por Região
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Map */}
          <div className="lg:col-span-2 relative">
            <TooltipProvider>
              <div className="h-[400px] bg-muted/20 rounded-lg overflow-hidden">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: 600,
                    center: [-55, -15],
                  }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <ZoomableGroup
                    zoom={position.zoom}
                    center={position.coordinates}
                    onMoveEnd={handleMoveEnd}
                  >
                    <Geographies geography={BRAZIL_TOPO_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const stateCode = geo.properties.sigla || geo.properties.UF;
                          const stateName = geo.properties.name || stateNames[stateCode] || stateCode;
                          const stateData = salesByState[stateCode] || { total: 0, count: 0 };
                          const isSelected = selectedState === stateCode;
                          
                          return (
                            <Tooltip key={geo.rsmKey}>
                              <TooltipTrigger asChild>
                                <Geography
                                  geography={geo}
                                  fill={colorScale(stateData.total)}
                                  stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                                  strokeWidth={isSelected ? 2 : 0.5}
                                  style={{
                                    default: { outline: 'none', cursor: 'pointer' },
                                    hover: { 
                                      outline: 'none', 
                                      fill: 'hsl(var(--primary))',
                                      cursor: 'pointer'
                                    },
                                    pressed: { outline: 'none' },
                                  }}
                                  onClick={() => setSelectedState(stateCode === selectedState ? null : stateCode)}
                                  onMouseEnter={() => {
                                    setTooltipContent(
                                      `${stateName}: ${formatCurrency(stateData.total)} (${stateData.count} vendas)`
                                    );
                                  }}
                                  onMouseLeave={() => setTooltipContent('')}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <p className="font-semibold">{stateName}</p>
                                  <p>{formatCurrency(stateData.total)}</p>
                                  <p className="text-muted-foreground">{stateData.count} vendas</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })
                      }
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>
              </div>
            </TooltipProvider>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur p-2 rounded-lg text-xs">
              <p className="font-medium mb-1">Legenda</p>
              <div className="flex items-center gap-2">
                <div className="flex">
                  <div className="w-4 h-3 bg-muted rounded-l" />
                  <div className="w-4 h-3" style={{ backgroundColor: 'hsl(221, 83%, 60%)' }} />
                  <div className="w-4 h-3" style={{ backgroundColor: 'hsl(221, 83%, 45%)' }} />
                  <div className="w-4 h-3 rounded-r" style={{ backgroundColor: 'hsl(221, 83%, 35%)' }} />
                </div>
                <span className="text-muted-foreground">Menos → Mais vendas</span>
              </div>
            </div>
          </div>

          {/* Sidebar with stats */}
          <div className="space-y-4">
            {/* Top States */}
            <div>
              <h4 className="font-medium text-sm mb-2">Top 5 Estados</h4>
              <div className="space-y-2">
                {topStates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados de vendas</p>
                ) : (
                  topStates.map(([code, data], index) => (
                    <button
                      key={code}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-colors ${
                        selectedState === code ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedState(code === selectedState ? null : code)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                          {index + 1}
                        </Badge>
                        <span className="text-sm font-medium">{stateNames[code] || code}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(data.total)}</p>
                        <p className="text-xs text-muted-foreground">{data.count} vendas</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selected State Cities */}
            {selectedState && selectedStateCities.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">
                  Cidades em {stateNames[selectedState] || selectedState}
                </h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {selectedStateCities.map(([city, data]) => (
                    <div
                      key={city}
                      className="flex items-center justify-between p-2 rounded text-sm bg-muted/30"
                    >
                      <span className="truncate">{city}</span>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="font-medium">{formatCurrency(data.total)}</span>
                        <span className="text-xs text-muted-foreground ml-1">({data.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BrazilSalesMap;
