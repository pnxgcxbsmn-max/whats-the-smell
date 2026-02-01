# 🧪 Testing del Sistema Beta Access

## ✅ Checklist de Validación

### Verificar que los archivos existen:
```powershell
# En terminal
Test-Path "c:\Users\luiso\Desktop\Whats-the-smell\Frontend\access-gate.js"  # Debe ser True
Test-Path "c:\Users\luiso\Desktop\Whats-the-smell\Frontend\index.html"     # Debe ser True
Test-Path "c:\Users\luiso\Desktop\Whats-the-smell\Frontend\app.js"         # Debe ser True
```

---

## 🌐 Pruebas en Browser

### 1. **Primer Acceso (Sin Token)**
1. Abre: https://whatsthesmell.ai (o localhost:3000)
2. Deberías ver: "BETA ACCESS" con icono de perro
3. Campo de contraseña vacío
4. Ingresa: `NoseKnows`
5. Espera: Animación de aroma (2 segundos)
6. Resultado: Transición suave al sitio

### 2. **Token Guardado**
1. Abre F12 (DevTools)
2. Consola → `localStorage.getItem('beta_access_token')`
3. Deberías ver:
```json
{
  "timestamp": 1737XXX0000,
  "generations": 0
}
```

### 3. **Recarga de Página**
1. Presiona F5 (refresh)
2. Deberías entrar directamente al sitio (SIN pedir contraseña)
3. El token es válido por 7 días

### 4. **Rate Limiting - Primera Generación**
1. Ingresa un personaje (ej: "Naruto")
2. Selecciona categoría (ej: "Anime")
3. Click en "Identify scent"
4. Consola → `getGenerationLimitInfo()`
5. Deberías ver:
```javascript
{
  used: 1,
  remaining: 9,
  limit: 10,
  percentage: 10
}
```

### 5. **Rate Limiting - Décima Generación**
1. Repite paso 4 nueve veces más
2. En la 10ª intento
3. Consola → `getGenerationLimitInfo()`
```javascript
{
  used: 10,
  remaining: 0,
  limit: 10,
  percentage: 100
}
```

### 6. **Rate Limiting - Bloqueado**
1. Intenta generar nuevamente
2. Deberías ver error: "Daily limit reached (10/10). Try again in 24 hours."
3. Botón "Identify scent" debe estar bloqueado

---

## 🔧 Pruebas en Consola

### Limpiar Token (Simular nuevo acceso)
```javascript
localStorage.removeItem('beta_access_token');
location.reload();
```

### Ver Información del Token
```javascript
const token = localStorage.getItem('beta_access_token');
console.log('Token:', JSON.parse(token));

const info = getGenerationLimitInfo();
console.log('Info:', info);
```

### Simular 24h Pasadas (Reset automático)
```javascript
const token = JSON.parse(localStorage.getItem('beta_access_token'));
token.timestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 horas atrás
localStorage.setItem('beta_access_token', JSON.stringify(token));
location.reload();

// Ahora getGenerationLimitInfo() debe mostrar:
// { used: 0, remaining: 10, limit: 10, percentage: 0 }
```

---

## 🎨 Pruebas Visuales

### Access Gate debe mostrar:
- ✅ Logo de perro flotando
- ✅ "BETA ACCESS" en texto
- ✅ "Early Access Program" subtítulo
- ✅ Campo input de contraseña
- ✅ Botón "ACCESS"
- ✅ Texto descriptivo abajo
- ✅ Fondo blur de perro

### Animaciones:
- ✅ Perro sube/baja continuamente
- ✅ Ondas de aroma alrededor del perro
- ✅ Recuadro entra desde abajo con slide
- ✅ Shake animation si contraseña es incorrecta
- ✅ Partículas flotan al validar
- ✅ Fade suave cuando sale la pantalla

### Contraseña incorrecta:
- ✅ Shake animation en el recuadro
- ✅ Error message rojo abajo
- ✅ Campo se vacía
- ✅ Focus automático en input

---

## ⚙️ Pruebas Técnicas

### Verificar que access-gate.js cargó:
```javascript
console.log(typeof initAccessGate);        // Debe ser "function"
console.log(typeof hasValidAccess);        // Debe ser "function"
console.log(typeof hasReachedGenerationLimit); // Debe ser "function"
```

### Verificar que app.js exportó initializeApp:
```javascript
console.log(typeof window.initializeApp);  // Debe ser "function"
```

### Verificar que main estaba oculto:
```javascript
const main = document.querySelector('main');
console.log(main.style.display);           // Debe ser "" (default o none)
console.log(getComputedStyle(main).display); // Debe ser "none" inicialmente
```

### Después de acceder:
```javascript
console.log(getComputedStyle(main).display); // Debe ser "block"
```

---

## 🚨 Posibles Errores

| Error | Solución |
|-------|----------|
| "Contraseña inválida" repetido | Verifica que escribiste `NoseKnows` exactamente |
| Pantalla negra en blanco | Asegúrate que access-gate.js cargó (`typeof initAccessGate`) |
| Main sigue invisible | Presiona F5 y verifica que localStorage tiene token válido |
| Rate limit no funciona | Verifica console que `incrementGenerationCounter` se llame |
| No se ve animación de aroma | Verifica que browser soporta CSS animation |

---

## 📊 Metricas de Éxito

- ✅ Access gate muestra en primer acceso
- ✅ Contraseña `NoseKnows` funciona
- ✅ Token se guarda en localStorage
- ✅ Segundo acceso entra directo (sin gate)
- ✅ Rate limiting bloquea en 10 generaciones
- ✅ Contador se resetea después de 24h
- ✅ Sin errores en consola
- ✅ Sitio web sigue funcionando normalmente

---

**Estado:** ✅ Sistema listo para testing
**Contraseña Beta:** `NoseKnows`
**Límite:** 10 generaciones cada 24 horas

