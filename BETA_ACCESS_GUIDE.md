# 🔐 Beta Early Access - Sistema Implementado

## ✅ Componentes Instalados

### 1. **Pantalla de Acceso (Access Gate)**
- Archivo: `Frontend/access-gate.js` (300+ líneas)
- **Contraseña Beta:** `NoseKnows`
- Temática: Fondo de perro (blur) + recuadro glassmorphism
- Animación: Partículas de aroma flotando
- Transición: Fade suave al sitio principal

### 2. **Rate Limiting (10 generaciones/24h)**
- Token guardado en localStorage con timestamp
- Contador reseteado automáticamente cada 24 horas
- Validación en `onGenerate()` antes de procesar

### 3. **Integración Sin Daños**
- App.js modificado para esperar inicialización
- Access gate se muestra automáticamente si no hay token válido
- Lógica existente completamente preservada

---

## 📋 Información Técnica

### **Contraseña Beta**
```
Contraseña: NoseKnows
Tipo: No obvia pero fácil de recordar
Temática: Juego de palabras (nose = nariz)
```

### **Sistema de Acceso**

**Archivos modificados:**
- ✅ `Frontend/access-gate.js` (NUEVO)
- ✅ `Frontend/index.html` (Agregado script + CSS hide)
- ✅ `Frontend/app.js` (Rate limiting + export initializeApp)

**Flujo:**
1. Usuario accede al sitio
2. `access-gate.js` verifica token en localStorage
3. Si no existe token válido → muestra puerta de acceso
4. Usuario ingresa contraseña `NoseKnows`
5. Animación de aroma (2 segundos)
6. Transición suave al sitio principal
7. Se guarda token con timestamp

### **Rate Limiting**

**localStorage Token:**
```json
{
  "timestamp": 1737892800000,
  "generations": 3
}
```

**Lógica:**
- Cada generación incrementa counter
- Si `timestamp + 24h < ahora` → reset a 0
- Bloquea si `generations >= 10`
- Mensaje: "Daily limit reached (X/10). Try again in 24 hours."

---

## 🎨 Características de la Pantalla

### **Visual**
- Logo de perro con ondas de aroma animadas
- "BETA ACCESS" + "Early Access Program"
- Fondo con imagen de perro blur (30% opacity)
- Recuadro glassmorphism (blur 20px, backdrop)
- Animación de "shake" en error
- Loading dots en botón

### **Animaciones**
- **Icon Float**: Sube/baja continuamente
- **Aroma Waves**: Ondas flotantes alrededor del perro
- **Slide Up**: Recuadro entra desde abajo
- **Fade Out**: Transición suave al salir
- **Partículas**: 20 partículas de aroma flotan al validar

### **Interacción**
- Input enfocado automáticamente
- Enter para enviar
- Error si contraseña es incorrecta
- Retry sin límite

---

## 🔧 Funciones Públicas (access-gate.js)

```javascript
// Inicializar la puerta
initAccessGate()

// Verificar si tiene acceso
hasValidAccess() → boolean

// Obtener info del límite
getGenerationLimitInfo() → {
  used: number,
  remaining: number,
  limit: 10,
  percentage: number
}

// Verificar si alcanzó límite
hasReachedGenerationLimit() → boolean

// Incrementar contador (se llama automáticamente)
incrementGenerationCounter()

// Obtener generaciones usadas hoy
getGenerationsUsedToday() → number
```

---

## 🚀 Cómo Usar

### **Acceso por Primera Vez**
1. Ir a https://whatsthesmell.ai
2. Ver pantalla "BETA ACCESS"
3. Ingresar contraseña: `NoseKnows`
4. Ver animación de aroma
5. Acceso garantizado por 7 días

### **Próximas Visitas**
- Si el token está válido (< 7 días): Acceso directo
- Si el token expiró (> 7 días): Pedir contraseña nuevamente

### **Límite de Generaciones**
- **Máximo:** 10 generaciones cada 24 horas
- **Contador:** Se resetea cada 24 horas automáticamente
- **Error:** Mostrará mensaje con X/10 usado

---

## 🧪 Testing

### **Probar Acceso Gate**
```javascript
// En browser console:
localStorage.removeItem('beta_access_token');
location.reload();
// Ingresa: NoseKnows
```

### **Probar Rate Limiting**
```javascript
// En browser console:
const info = getGenerationLimitInfo();
console.log(info);
// { used: 3, remaining: 7, limit: 10, percentage: 30 }
```

### **Limpiar Token**
```javascript
localStorage.removeItem('beta_access_token');
```

---

## ⚙️ Configuración

Todos los valores están en el top de `access-gate.js`:

```javascript
const BETA_PASSWORD = "NoseKnows";           // Cambiar contraseña
const GENERATION_LIMIT = 10;                  // Cambiar límite
const LIMIT_WINDOW = 24 * 60 * 60 * 1000;   // Cambiar período (ms)
const ACCESS_TOKEN_KEY = "beta_access_token";  // Cambiar clave localStorage
```

---

## ✨ No Genera Daños

✅ **Preservado:**
- Toda lógica de generación de olores
- Cache y API calls
- Service Worker
- Responsive design
- Performance optimizations
- Bilingual translations

✅ **Aislado:**
- Access gate en archivo separado
- localStorage independiente
- Cierre de sesión no afecta app.js
- Puedo remover sin breaks

---

## 📝 Notas

- **Contraseña:** `NoseKnows` (puedes cambiarla en access-gate.js línea 3)
- **Límite:** 10 generaciones por 24 horas (modificable en línea 4)
- **Token expira:** 7 días (línea 35, modificable)
- **Partículas animadas:** 20 (línea 194, modificable)

---

**Status:** ✅ LISTO PARA PRODUCCIÓN

El sistema está completamente funcional y no interfiere con ninguna lógica existente.

