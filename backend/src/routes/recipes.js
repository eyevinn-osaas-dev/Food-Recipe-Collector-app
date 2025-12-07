import express from 'express';
import { query } from '../db.js';
import { scrapeRecipe } from '../scraper.js';

const router = express.Router();

function serializeRow(row) {
  const toArray = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    description: row.description || '',
    image: row.image_url || '',
    servings: row.servings || '',
    prepTime: row.prep_time || '',
    cookTime: row.cook_time || '',
    totalTime: row.total_time || '',
    ingredients: toArray(row.ingredients),
    instructions: toArray(row.instructions),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.get('/', async (req, res, next) => {
  try {
    const search = req.query.q?.trim();
    const archived = req.query.archived;
    let sql = 'SELECT * FROM recipes';
    const params = [];

    if (archived === 'true') {
      sql += ' WHERE archived_at IS NOT NULL';
    } else {
      sql += ' WHERE archived_at IS NULL';
    }

    if (search) {
      sql += ' AND (title LIKE ? OR source_url LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await query(sql, params);
    res.json(rows.map(serializeRow));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: req.t('recipeNotFound') });
    return res.json(serializeRow(rows[0]));
  } catch (err) {
    return next(err);
  }
});

router.post('/import', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: req.t('urlRequired') });

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ message: req.t('invalidUrl') });
    }

    const [existing] = await query('SELECT * FROM recipes WHERE source_url = ?', [parsedUrl.toString()]);
    if (existing.length) {
      return res.status(200).json({ recipe: serializeRow(existing[0]), message: req.t('recipeAlreadySaved') });
    }

    const recipeData = await scrapeRecipe(parsedUrl.toString());

    const [result] = await query(
      `INSERT INTO recipes 
       (title, source_url, description, image_url, servings, prep_time, cook_time, total_time, ingredients, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipeData.title,
        parsedUrl.toString(),
        recipeData.description,
        recipeData.image,
        recipeData.servings,
        recipeData.prepTime,
        recipeData.cookTime,
        recipeData.totalTime,
        JSON.stringify(recipeData.ingredients || []),
        JSON.stringify(recipeData.instructions || [])
      ]
    );

    const [rows] = await query('SELECT * FROM recipes WHERE id = ?', [result.insertId]);
    return res.status(201).json({ recipe: serializeRow(rows[0]) });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, description, image, servings, prepTime, cookTime, totalTime, ingredients, instructions } = req.body;
    const [rows] = await query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: req.t('recipeNotFound') });

    const payload = {
      title: title?.trim() || rows[0].title,
      description: description ?? rows[0].description,
      image: image ?? rows[0].image_url,
      servings: servings ?? rows[0].servings,
      prepTime: prepTime ?? rows[0].prep_time,
      cookTime: cookTime ?? rows[0].cook_time,
      totalTime: totalTime ?? rows[0].total_time,
      ingredients: Array.isArray(ingredients) ? ingredients : JSON.parse(rows[0].ingredients || '[]'),
      instructions: Array.isArray(instructions) ? instructions : JSON.parse(rows[0].instructions || '[]')
    };

    await query(
      `UPDATE recipes
       SET title = ?, description = ?, image_url = ?, servings = ?, prep_time = ?, cook_time = ?, total_time = ?, ingredients = ?, instructions = ?
       WHERE id = ?`,
      [
        payload.title,
        payload.description,
        payload.image,
        payload.servings,
        payload.prepTime,
        payload.cookTime,
        payload.totalTime,
        JSON.stringify(payload.ingredients),
        JSON.stringify(payload.instructions),
        req.params.id
      ]
    );

    const [updated] = await query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    return res.json({ recipe: serializeRow(updated[0]) });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    const [rows] = await query('SELECT id FROM recipes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: req.t('recipeNotFound') });
    await query('UPDATE recipes SET archived_at = NOW() WHERE id = ?', [req.params.id]);
    const [updated] = await query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    return res.json({ recipe: serializeRow(updated[0]) });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/unarchive', async (req, res, next) => {
  try {
    const [rows] = await query('SELECT id FROM recipes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: req.t('recipeNotFound') });
    await query('UPDATE recipes SET archived_at = NULL WHERE id = ?', [req.params.id]);
    const [updated] = await query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    return res.json({ recipe: serializeRow(updated[0]) });
  } catch (err) {
    return next(err);
  }
});

export default router;
