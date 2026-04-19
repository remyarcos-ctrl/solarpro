path = 'C:/Users/Utilisateur/solarpro/src/components/dossier/SatelliteMap.jsx'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

def r(old, new, label):
    global src
    o = old.replace('\r\n', '\n')
    if o in src:
        src = src.replace(o, new)
        print(f'OK: {label}')
    else:
        print(f'FAIL: {label}')

r(
    'import { MapPin, Pencil, Trash2, RotateCcw, Layers, Plus, Zap } from "lucide-react";',
    'import { MapPin, Pencil, Trash2, RotateCcw, Layers, Plus } from "lucide-react";',
    'remove Zap'
)

r(
    '  geocode, geojsonArea, buildPanelGridRotated, detectPanOrientation,\n  PAN_COLORS, getSolarCoefficient, getPanelColor, getBoundingBoxMeters, azimutToOrientation,\n} from "./roofUtils";',
    '  geocode, geojsonArea, buildPanelGridRotated, detectPanOrientation,\n  PAN_COLORS, getSolarCoefficient, getPanelColor, getBoundingBoxMeters,\n} from "./roofUtils";',
    'remove azimutToOrientation'
)

r(
    '  onRoofAreaChange, onMaxPanelsChange, onCaptureReady,\n  onRoofDimensionsChange, solarDataRef,\n})',
    '  onRoofAreaChange, onMaxPanelsChange, onCaptureReady,\n  onRoofDimensionsChange, solarDataRef, onDataReady,\n})',
    'add onDataReady prop'
)

r(
    '  // Geocodage SANS auto-injection Solar\n  useEffect(() => {\n    if (!map || !address || address.trim().length < 5) return;\n    const mbMap = map.getMap();\n    setLoading(true);\n    setPans([]);\n    drawRef.current?.deleteAll();\n    markersRef.current.forEach(m => m.remove());\n    markersRef.current = [];\n    geocode(address).then(c => {\n      setLoading(false);\n      if (!c) return;\n      setCoords(c);\n      window.__smCoords = c;\n      const el = document.createElement("div");\n      el.style.cssText = "width:14px;height:14px;background:#E8A020;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(232,160,32,0.3)";\n      const mk = new mapboxgl.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(mbMap);\n      markersRef.current.push(mk);\n      mbMap.flyTo({ center: [c.lon, c.lat], zoom: 20, pitch: 45, bearing: 0, duration: 2000 });\n    });\n  }, [address, map]);',
    '  useEffect(() => {\n    if (!map || !address || address.trim().length < 5) return;\n    const mbMap = map.getMap();\n    setLoading(true);\n    setPans([]);\n    drawRef.current?.deleteAll();\n    markersRef.current.forEach(m => m.remove());\n    markersRef.current = [];\n    geocode(address).then(async c => {\n      setLoading(false);\n      if (!c) return;\n      setCoords(c);\n      window.__smCoords = c;\n      const el = document.createElement("div");\n      el.style.cssText = "width:14px;height:14px;background:#E8A020;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(232,160,32,0.3)";\n      const mk = new mapboxgl.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(mbMap);\n      markersRef.current.push(mk);\n      mbMap.flyTo({ center: [c.lon, c.lat], zoom: 20, pitch: 45, bearing: 0, duration: 2000 });\n\n      // Chargement silencieux des donn\u00e9es satellite en arri\u00e8re-plan\n      const [solarResult, ignResult] = await Promise.allSettled([\n        fetchGoogleSolarData(c.lat, c.lon),\n        analyzeRoofFromGPS(c.lat, c.lon),\n      ]);\n      if (solarResult.status === "fulfilled" && solarResult.value?.solarPotential?.roofSegmentStats?.length > 0) {\n        solarDataRef.current = solarResult.value;\n        window.__smSolarSegments = solarResult.value.solarPotential.roofSegmentStats;\n      }\n      if (ignResult.status === "fulfilled" && ignResult.value) {\n        solarDataRef.current = solarDataRef.current ?? {};\n        solarDataRef.current.__ignRoof = ignResult.value;\n      }\n      onDataReady?.();\n    });\n  }, [address, map]);',
    'geocode auto-fetch background'
)

r(
    '  const [ready,        setReady]        = useState(false);\n  const [isDrawing,    setIsDrawing]    = useState(false);\n  const [pans,         setPans]         = useState([]);\n  const [coords,       setCoords]       = useState(null);\n  const [pitch,        setPitch]        = useState(45);\n  const [bearing,      setBearing]      = useState(0);\n  const [showLabels,   setShowLabels]   = useState(false);\n  const [loading,      setLoading]      = useState(false);\n  const [solarLoading, setSolarLoading] = useState(false);\n  const [solarData,    setSolarData]    = useState(null);\n  const [solarInfo,    setSolarInfo]    = useState(null);\n  const solarDataRef = useRef(null);\n\n  const handleLoadSolar = async () => {\n    if (!coords) return;\n    setSolarLoading(true);\n    const data = await fetchGoogleSolarData(coords.lat, coords.lon);\n    setSolarLoading(false);\n    if (!data?.solarPotential?.roofSegmentStats?.length) return;\n    setSolarData(data);\n    solarDataRef.current = data;\n    const segments = data.solarPotential.roofSegmentStats;\n    const main = segments\n      .filter(s => s.stats?.areaMeters2 > 10 && s.pitchDegrees < 70)\n      .sort((a, b) => (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0))[0];\n    if (main) {\n      setSolarInfo({ inclination: Math.round(main.pitchDegrees || 30) });\n      window.__smSolarSegments = segments;\n    }\n  };',
    '  const [ready,      setReady]      = useState(false);\n  const [isDrawing,  setIsDrawing]  = useState(false);\n  const [pans,       setPans]       = useState([]);\n  const [coords,     setCoords]     = useState(null);\n  const [pitch,      setPitch]      = useState(45);\n  const [bearing,    setBearing]    = useState(0);\n  const [showLabels, setShowLabels] = useState(false);\n  const [loading,    setLoading]    = useState(false);\n  const [dataReady,  setDataReady]  = useState(false);\n  const solarDataRef = useRef(null);',
    'states cleanup'
)

r(
    '      {/* Info Solar API */}\n      {solarInfo && (\n        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 text-xs text-emerald-300 flex items-center gap-2 flex-wrap">\n          <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />\n          <span>\n            \u2713 Solar API \u2014 inclinaison d\u00e9tect\u00e9e : <strong className="text-white">{solarInfo.inclination}\u00b0</strong>\n          </span>\n        </div>\n      )}',
    '',
    'remove solarInfo banner'
)

r(
    '        {coords && <Button size="sm" variant="outline" onClick={() => act("resetView", coords)} title="Recentrer"><RotateCcw className="w-4 h-4" /></Button>}\n        {coords && (\n          <Button size="sm" variant="outline" onClick={handleLoadSolar} disabled={solarLoading}\n            className={solarData ? "border-emerald-500/50 text-emerald-400" : "border-violet-500/50 text-violet-400"}>\n            <Zap className="w-4 h-4 mr-1" />\n            {solarLoading ? "Analyse\u2026" : solarData ? "\u2713 Solar API" : "Solar API"}\n          </Button>\n        )}\n        {solarData && pans.length > 0 && (\n          <Button size="sm" variant="outline" onClick={() => act("updatePansOrientation")}\n            className="border-emerald-500/50 text-emerald-400 text-xs">\n            \u21ba Appliquer inclinaison Solar\n          </Button>\n        )}\n        <Button size="sm" variant="outline" onClick={() => act("toggleLabels", !showLabels)}>\n          <Layers className="w-4 h-4 mr-1" />{showLabels ? "Sans labels" : "+ Labels rues"}\n        </Button>\n        {totalArea > 0 && (\n          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">\n            <span>{pans.length} pan{pans.length > 1 ? "s" : ""}</span>\n            <span>Surface : <strong className="text-foreground">{totalArea} m\u00b2</strong></span>\n            <span>Max : <strong className="text-primary">{totalPanels} pan.</strong></span>\n          </div>\n        )}',
    '        {coords && <Button size="sm" variant="outline" onClick={() => act("resetView", coords)} title="Recentrer"><RotateCcw className="w-4 h-4" /></Button>}\n        <Button size="sm" variant="outline" onClick={() => act("toggleLabels", !showLabels)}>\n          <Layers className="w-4 h-4 mr-1" />{showLabels ? "Sans labels" : "+ Labels rues"}\n        </Button>\n        {dataReady && (\n          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">\n            \ud83d\udce1 Donn\u00e9es satellite charg\u00e9es\n          </span>\n        )}\n        {totalArea > 0 && (\n          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">\n            <span>{pans.length} pan{pans.length > 1 ? "s" : ""}</span>\n            <span>Surface : <strong className="text-foreground">{totalArea} m\u00b2</strong></span>\n            <span>Max : <strong className="text-primary">{totalPanels} pan.</strong></span>\n          </div>\n        )}',
    'toolbar Solar buttons -> badge'
)

r(
    '        {solarLoading && (\n          <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center">\n            <div className="bg-black/80 backdrop-blur-sm rounded-xl px-6 py-4 flex items-center gap-3">\n              <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />\n              <span className="text-white text-sm font-semibold">Google Solar \u2014 analyse en cours\u2026</span>\n            </div>\n          </div>\n        )}',
    '',
    'remove solarLoading overlay'
)

r(
    '            onCaptureReady={onCaptureReady} onRoofDimensionsChange={onRoofDimensionsChange}\n            solarDataRef={solarDataRef}',
    '            onCaptureReady={onCaptureReady} onRoofDimensionsChange={onRoofDimensionsChange}\n            solarDataRef={solarDataRef} onDataReady={() => setDataReady(true)}',
    'pass onDataReady to MapController'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)

checks = [
    ('Zap removed', 'Zap' not in src.split('import { MapPin')[1].split('"lucide-react"')[0]),
    ('azimutToOrientation removed', 'azimutToOrientation' not in src),
    ('handleLoadSolar removed', 'handleLoadSolar' not in src),
    ('solarLoading removed', 'solarLoading' not in src),
    ('setSolarData removed', 'setSolarData' not in src),
    ('dataReady added', 'dataReady' in src),
    ('background fetch', 'Promise.allSettled' in src),
    ('badge present', 'satellite charg' in src),
    ('Solar API btn removed', '"Solar API"' not in src),
    ('overlay removed', 'Google Solar' not in src),
    ('onDataReady passed', 'onDataReady={() => setDataReady(true)}' in src),
]
for label, ok in checks:
    print(f'{"OK" if ok else "FAIL"}: {label}')
