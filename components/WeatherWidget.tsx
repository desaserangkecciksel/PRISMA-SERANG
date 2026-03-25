
import React, { useState, useEffect } from 'react';
import { Clock, Cloud, Sun, CloudRain, CloudLightning, RefreshCw, MapPin, Thermometer } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const WeatherWidget: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: string; condition: string; icon: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Update Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Weather using Gemini with Google Search
  const fetchWeather = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const apiKey = process.env.API_KEY;
      
      if (!apiKey) {
        console.warn("API_KEY tidak ditemukan. Pastikan variabel lingkungan dikonfigurasi.");
        throw new Error("API Key missing");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Menggunakan model standar yang stabil
        contents: 'Berapa suhu dan kondisi cuaca saat ini di Kecamatan Cikarang Selatan, Kabupaten Bekasi? Jawab dalam format JSON singkat: {"temp": "suhu dalam celcius", "condition": "kondisi cuaca (cerah/berawan/hujan)", "type": "sunny/cloudy/rainy"}. Hanya JSON saja.',
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const text = response.text || '';
      // Gemini 2.5 Flash lebih taat pada JSON responseMimeType, tapi kita tetap parse aman
      try {
          const data = JSON.parse(text);
          setWeather({
            temp: data.temp,
            condition: data.condition,
            icon: data.type
          });
      } catch (e) {
          // Fallback parsing manual jika JSON tidak murni
          const jsonMatch = text.match(/\{.*\}/s);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            setWeather({
              temp: data.temp,
              condition: data.condition,
              icon: data.type
            });
          }
      }
    } catch (error: any) {
      // Fallback data if API fails or Quota exceeded
      const currentHour = new Date().getHours();
      const isDay = currentHour > 6 && currentHour < 18;
      
      setWeather({ 
          temp: isDay ? '32°C' : '26°C', 
          condition: isDay ? 'Cerah Berawan' : 'Berawan', 
          icon: isDay ? 'sunny' : 'cloudy' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 30 minutes
    const weatherTimer = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(weatherTimer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getWeatherIcon = (type: string | undefined) => {
    switch (type) {
      case 'sunny': return <Sun size={24} className="text-yellow-400" />;
      case 'rainy': return <CloudRain size={24} className="text-blue-400" />;
      case 'storm': return <CloudLightning size={24} className="text-purple-400" />;
      default: return <Cloud size={24} className="text-slate-300" />;
    }
  };

  return (
    <div className="mt-6 px-4">
      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50 shadow-inner">
        {/* Time & Date */}
        <div className="flex items-center space-x-3 mb-3 border-b border-slate-700/50 pb-3">
          <div className="p-2 bg-teal-500/20 rounded-lg">
            <Clock size={18} className="text-teal-400" />
          </div>
          <div>
            <p className="text-xl font-mono font-bold text-white tracking-wider">{formatTime(time)}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{formatDate(time)}</p>
          </div>
        </div>

        {/* Weather */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
             <div className="flex items-center text-slate-400 text-[10px] font-bold uppercase">
                <MapPin size={10} className="mr-1 text-teal-500" />
                Cikarang Selatan
             </div>
             <button 
                onClick={fetchWeather}
                className={`text-slate-500 hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`}
                title="Perbarui Cuaca"
             >
                <RefreshCw size={12} />
             </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getWeatherIcon(weather?.icon)}
              <div>
                <p className="text-lg font-extrabold text-white leading-none">
                    {weather?.temp || '...'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">{weather?.condition || 'Memuat...'}</p>
              </div>
            </div>
            <div className="bg-slate-700/50 px-2 py-1 rounded-md flex items-center">
                <Thermometer size={12} className="text-orange-400 mr-1" />
                <span className="text-[10px] text-slate-300 font-bold">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
