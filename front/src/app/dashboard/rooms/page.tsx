'use client';

import React from 'react';

export default function RoomsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Salas de Estudio</h1>
        <p className="text-gray-500">Crea salas grupales y comparte documentos con tus compañeros de equipo.</p>
      </div>

      {/* Grid de Contenido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Acciones rápidas */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 md:col-span-1 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Gestión de Salas</h2>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition">
            + Crear Nueva Sala
          </button>
          <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded transition">
            Unirse con Código
          </button>
        </div>

        {/* Columna Derecha: Lista de Salas activas */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Mis Salas Activas</h2>
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
            Aún no perteneces a ninguna sala de estudio. ¡Crea una para comenzar!
          </div>
        </div>

      </div>
    </div>
  );
}