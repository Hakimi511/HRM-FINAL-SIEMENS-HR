// =========================================================================
// 数据加载：questions.json / materials.json（带缓存）
// =========================================================================
let _questions = null;
let _materials = null;

export async function loadQuestions() {
  if (_questions) return _questions;
  const res = await fetch('data/questions.json');
  if (!res.ok) throw new Error('题库加载失败 ' + res.status);
  _questions = await res.json();
  return _questions;
}

export async function loadMaterials() {
  if (_materials) return _materials;
  const res = await fetch('data/materials.json');
  if (!res.ok) throw new Error('资料清单加载失败 ' + res.status);
  _materials = await res.json();
  return _materials;
}

/** 按 id 取单题（用于错题本重练） */
export function questionsById(ids) {
  if (!_questions) return [];
  const set = new Set(ids);
  return _questions.questions.filter(q => set.has(q.id));
}

/** 取某模块的全部题 */
export function questionsByModule(moduleId) {
  if (!_questions) return [];
  return _questions.questions.filter(q => q.module === moduleId);
}

/** 取某分类的全部题 */
export function questionsByCategory(cat) {
  if (!_questions) return [];
  return _questions.questions.filter(q => q.category === cat);
}

export function getModuleById(id) {
  return _questions ? _questions.modules.find(m => m.id === id) : null;
}
