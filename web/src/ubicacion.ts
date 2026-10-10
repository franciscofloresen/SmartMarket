// Detecta el estado de la República a partir de la ubicación del teléfono.
// Todo se calcula aquí: las coordenadas no salen del dispositivo, solo se guarda el estado.

// [ciudad, estado (como lo escribe Profeco), latitud, longitud]
const CIUDADES: [string, string, number, number][] = [
  ["Aguascalientes", "Aguascalientes", 21.88, -102.29],
  ["Tijuana", "Baja California", 32.52, -117.03],
  ["Mexicali", "Baja California", 32.62, -115.45],
  ["Ensenada", "Baja California", 31.87, -116.6],
  ["La Paz", "Baja California Sur", 24.14, -110.31],
  ["Los Cabos", "Baja California Sur", 23.06, -109.7],
  ["Campeche", "Campeche", 19.84, -90.53],
  ["Ciudad del Carmen", "Campeche", 18.65, -91.82],
  ["Tuxtla Gutiérrez", "Chiapas", 16.75, -93.12],
  ["Tapachula", "Chiapas", 14.9, -92.26],
  ["San Cristóbal de las Casas", "Chiapas", 16.74, -92.64],
  ["Chihuahua", "Chihuahua", 28.63, -106.07],
  ["Ciudad Juárez", "Chihuahua", 31.69, -106.42],
  ["Delicias", "Chihuahua", 28.19, -105.47],
  ["Parral", "Chihuahua", 26.93, -105.66],
  ["Ciudad de México", "Ciudad de México", 19.43, -99.13],
  ["Ciudad de México", "Ciudad de México", 19.3, -99.16],
  ["Ciudad de México", "Ciudad de México", 19.36, -99.06],
  ["Ciudad de México", "Ciudad de México", 19.48, -99.11],
  ["Ciudad de México", "Ciudad de México", 19.36, -99.27],
  ["Ciudad de México", "Ciudad de México", 19.26, -99.1],
  ["Saltillo", "Coahuila", 25.42, -101.0],
  ["Torreón", "Coahuila", 25.54, -103.41],
  ["Monclova", "Coahuila", 26.9, -101.42],
  ["Piedras Negras", "Coahuila", 28.7, -100.52],
  ["Colima", "Colima", 19.24, -103.72],
  ["Manzanillo", "Colima", 19.05, -104.32],
  ["Durango", "Durango", 24.02, -104.66],
  ["Gómez Palacio", "Durango", 25.57, -103.5],
  ["Toluca", "Estado de México", 19.29, -99.66],
  ["Ecatepec", "Estado de México", 19.6, -99.05],
  ["Naucalpan", "Estado de México", 19.48, -99.24],
  ["Nezahualcóyotl", "Estado de México", 19.4, -99.01],
  ["Tlalnepantla", "Estado de México", 19.54, -99.19],
  ["Cuautitlán Izcalli", "Estado de México", 19.65, -99.21],
  ["Chalco", "Estado de México", 19.26, -98.9],
  ["Texcoco", "Estado de México", 19.51, -98.88],
  ["León", "Guanajuato", 21.12, -101.68],
  ["Irapuato", "Guanajuato", 20.68, -101.35],
  ["Celaya", "Guanajuato", 20.52, -100.81],
  ["Guanajuato", "Guanajuato", 21.02, -101.26],
  ["Salamanca", "Guanajuato", 20.57, -101.2],
  ["Acapulco", "Guerrero", 16.86, -99.88],
  ["Chilpancingo", "Guerrero", 17.55, -99.5],
  ["Iguala", "Guerrero", 18.35, -99.54],
  ["Zihuatanejo", "Guerrero", 17.64, -101.55],
  ["Pachuca", "Hidalgo", 20.12, -98.73],
  ["Tulancingo", "Hidalgo", 20.08, -98.37],
  ["Tula", "Hidalgo", 20.05, -99.34],
  ["Guadalajara", "Jalisco", 20.67, -103.35],
  ["Zapopan", "Jalisco", 20.72, -103.39],
  ["Puerto Vallarta", "Jalisco", 20.65, -105.23],
  ["Lagos de Moreno", "Jalisco", 21.36, -101.93],
  ["Ciudad Guzmán", "Jalisco", 19.7, -103.46],
  ["Tepatitlán", "Jalisco", 20.82, -102.76],
  ["Morelia", "Michoacán", 19.7, -101.19],
  ["Uruapan", "Michoacán", 19.42, -102.06],
  ["Zamora", "Michoacán", 19.98, -102.28],
  ["Lázaro Cárdenas", "Michoacán", 17.96, -102.19],
  ["Cuernavaca", "Morelos", 18.92, -99.23],
  ["Cuautla", "Morelos", 18.81, -98.95],
  ["Tepic", "Nayarit", 21.5, -104.89],
  ["Bucerías", "Nayarit", 20.75, -105.33],
  ["Monterrey", "Nuevo León", 25.67, -100.31],
  ["San Pedro Garza García", "Nuevo León", 25.66, -100.4],
  ["Guadalupe", "Nuevo León", 25.68, -100.26],
  ["Apodaca", "Nuevo León", 25.78, -100.19],
  ["Linares", "Nuevo León", 24.86, -99.57],
  ["Oaxaca", "Oaxaca", 17.07, -96.72],
  ["Salina Cruz", "Oaxaca", 16.17, -95.2],
  ["Tuxtepec", "Oaxaca", 18.09, -96.12],
  ["Huatulco", "Oaxaca", 15.77, -96.13],
  ["Puerto Escondido", "Oaxaca", 15.87, -97.07],
  ["Puebla", "Puebla", 19.04, -98.2],
  ["Tehuacán", "Puebla", 18.46, -97.39],
  ["Teziutlán", "Puebla", 19.82, -97.36],
  ["Querétaro", "Querétaro", 20.59, -100.39],
  ["San Juan del Río", "Querétaro", 20.39, -99.99],
  ["Cancún", "Quintana Roo", 21.16, -86.85],
  ["Playa del Carmen", "Quintana Roo", 20.63, -87.08],
  ["Cozumel", "Quintana Roo", 20.51, -86.95],
  ["Tulum", "Quintana Roo", 20.21, -87.46],
  ["Chetumal", "Quintana Roo", 18.5, -88.3],
  ["San Luis Potosí", "San Luis Potosí", 22.15, -100.98],
  ["Ciudad Valles", "San Luis Potosí", 21.99, -99.01],
  ["Matehuala", "San Luis Potosí", 23.65, -100.64],
  ["Culiacán", "Sinaloa", 24.81, -107.39],
  ["Mazatlán", "Sinaloa", 23.25, -106.41],
  ["Los Mochis", "Sinaloa", 25.79, -108.99],
  ["Hermosillo", "Sonora", 29.07, -110.96],
  ["Ciudad Obregón", "Sonora", 27.49, -109.94],
  ["Nogales", "Sonora", 31.31, -110.94],
  ["Guaymas", "Sonora", 27.92, -110.9],
  ["Navojoa", "Sonora", 27.07, -109.44],
  ["San Luis Río Colorado", "Sonora", 32.46, -114.77],
  ["Villahermosa", "Tabasco", 17.99, -92.93],
  ["Cárdenas", "Tabasco", 18.0, -93.38],
  ["Comalcalco", "Tabasco", 18.26, -93.22],
  ["Reynosa", "Tamaulipas", 26.09, -98.28],
  ["Matamoros", "Tamaulipas", 25.87, -97.5],
  ["Nuevo Laredo", "Tamaulipas", 27.48, -99.52],
  ["Tampico", "Tamaulipas", 22.25, -97.86],
  ["Ciudad Victoria", "Tamaulipas", 23.74, -99.14],
  ["Tlaxcala", "Tlaxcala", 19.32, -98.24],
  ["Apizaco", "Tlaxcala", 19.42, -98.14],
  ["Huamantla", "Tlaxcala", 19.31, -97.92],
  ["Veracruz", "Veracruz", 19.17, -96.13],
  ["Xalapa", "Veracruz", 19.54, -96.91],
  ["Córdoba", "Veracruz", 18.88, -96.93],
  ["Orizaba", "Veracruz", 18.85, -97.1],
  ["Poza Rica", "Veracruz", 20.53, -97.46],
  ["Tuxpan", "Veracruz", 20.96, -97.4],
  ["Coatzacoalcos", "Veracruz", 18.13, -94.46],
  ["Minatitlán", "Veracruz", 17.99, -94.55],
  ["Mérida", "Yucatán", 20.97, -89.62],
  ["Progreso", "Yucatán", 21.28, -89.66],
  ["Valladolid", "Yucatán", 20.69, -88.2],
  ["Zacatecas", "Zacatecas", 22.77, -102.58],
  ["Fresnillo", "Zacatecas", 23.17, -102.87],
];

// Más lejos que esto de cualquier ciudad de la tabla, no adivinamos el estado.
const MAX_KM = 200;

export interface Ubicacion {
  ciudad: string;
  estado: string;
}

/** Ciudad de la tabla más cercana a las coordenadas, o null si queda demasiado lejos. */
export function ciudadMasCercana(latitud: number, longitud: number): Ubicacion | null {
  const kmPorGradoLon = 111.3 * Math.cos((latitud * Math.PI) / 180);
  let mejor: Ubicacion | null = null;
  let menor = MAX_KM;
  for (const [ciudad, estado, lat, lon] of CIUDADES) {
    const km = Math.hypot((lat - latitud) * 110.6, (lon - longitud) * kmPorGradoLon);
    if (km < menor) {
      menor = km;
      mejor = { ciudad, estado };
    }
  }
  return mejor;
}

/** Pide la ubicación al navegador. Rechaza con un mensaje listo para mostrar. */
export function ubicar(): Promise<Ubicacion> {
  return new Promise((resolver, rechazar) => {
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      rechazar(new Error("Este navegador solo comparte la ubicación en una conexión segura (https). Elige tu estado de la lista."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const lugar = ciudadMasCercana(posicion.coords.latitude, posicion.coords.longitude);
        if (lugar) resolver(lugar);
        else rechazar(new Error("No reconocimos tu ubicación dentro de México. Elige tu estado de la lista."));
      },
      (error) =>
        rechazar(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "No tenemos permiso para ver tu ubicación. Elige tu estado de la lista."
              : "No pudimos obtener tu ubicación. Elige tu estado de la lista.",
          ),
        ),
      // Basta con precisión de ciudad: es más rápido y no enciende el GPS.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  });
}
