// ============================================
// ASCEND · Planner Logic
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { toast } from './utils.js';

/* ============================================
   CONSTANTS
   ============================================ */
const STORAGE_KEY = 'ascend:planner';
const AR_DAYS = [
  { id: 'saturday',  name: 'السبت',    idx: 6, emoji: '🌅' },
  { id: 'sunday',    name: 'الأحد',    idx: 0, emoji: '🌞' },
  { id: 'monday',    name: 'الاثنين',  idx: 1, emoji: '🌙' },
  { id: 'tuesday',   name: 'الثلاثاء', idx: 2, emoji: '⭐' },
  { id: 'wednesday', name: 'الأربعاء', idx: 3, emoji: '☀️' },
  { id: 'thursday',  name: 'الخميس',   idx: 4, emoji: '🌤️' },
  { id: 'friday',    name: 'الجمعة',   idx: 5, emoji: '🎉' }
];

/* ============================================
   STATE
   ============================================ */
let Data = {
  plans: {},      // { lessonId: { day, startHour, hours, completedAt, grade } }
  picked: {},     // { lessonId: true } - دروس مختارة بدون موعد
  timer: null,    // { lessonId, remainingSeconds, totalSeconds, paused }
  streak: 0,
  lastActive: null,
  totalMinutes: 0
};

let Subjects = [];   // من Supabase

/* ============================================
   LOCAL STORAGE
   ============================================ */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      Data = { ...Data, ...p };
    }
  } catch (e) { console.warn('loadData err', e); }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Data));
  } catch (e) { console.warn('saveData err', e); }
}

/* ============================================
   LOAD SUBJECTS FROM SUPABASE
   ============================================ */
async function loadSubjects() {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, color, chapters(id, title, lessons(id, title, order))')
      .order('name');

    if (error) throw error;

    Subjects = (data || []).map(s => {
      const lessons = [];
      (s.chapters || []).forEach(ch => {
        (ch.lessons || []).forEach(l
