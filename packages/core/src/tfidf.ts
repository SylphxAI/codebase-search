/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) implementation
 * Simplified version for codebase search
 */

export interface DocumentVector {
  uri: string;
  terms: Map<string, number>; // term → TF-IDF score
  rawTerms: Map<string, number>; // term → raw frequency
  magnitude: number; // Vector magnitude for cosine similarity
}

export interface SearchIndex {
  documents: DocumentVector[];
  idf: Map<string, number>; // term → IDF score
  totalDocuments: number;
  metadata: {
    generatedAt: string;
    version: string;
  };
}

/**
 * Simple code-aware tokenizer
 * Extracts identifiers, keywords, and meaningful terms from code
 */
function tokenize(text: string): string[] {
  // Common code keywords to boost
  const keywords = new Set([
    'function', 'const', 'let', 'var', 'class', 'interface', 'type',
    'async', 'await', 'return', 'import', 'export', 'from',
    'if', 'else', 'for', 'while', 'switch', 'case',
  ]);

  const tokens: string[] = [];

  // Extract identifiers (camelCase, snake_case, PascalCase)
  const identifierPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  const matches = text.match(identifierPattern) || [];

  for (const match of matches) {
    const lower = match.toLowerCase();

    // Add the token
    tokens.push(lower);

    // Boost keywords by adding them multiple times
    if (keywords.has(lower)) {
      tokens.push(lower, lower);
    }

    // Split camelCase into parts
    const parts = match.split(/(?=[A-Z])/).filter(p => p.length > 1);
    if (parts.length > 1) {
      tokens.push(...parts.map(p => p.toLowerCase()));
    }

    // Split snake_case into parts
    if (match.includes('_')) {
      const underscoreParts = match.split('_').filter(p => p.length > 1);
      tokens.push(...underscoreParts.map(p => p.toLowerCase()));
    }
  }

  return tokens;
}

/**
 * Calculate Term Frequency (TF)
 */
function calculateTF(termFrequency: Map<string, number>): Map<string, number> {
  const totalTerms = Array.from(termFrequency.values()).reduce((sum, freq) => sum + freq, 0);
  const tf = new Map<string, number>();

  for (const [term, freq] of termFrequency.entries()) {
    tf.set(term, freq / totalTerms);
  }

  return tf;
}

/**
 * Calculate Inverse Document Frequency (IDF)
 */
function calculateIDF(
  documents: Map<string, number>[],
  totalDocuments: number
): Map<string, number> {
  const documentFrequency = new Map<string, number>();

  // Count how many documents contain each term
  for (const doc of documents) {
    const uniqueTerms = new Set(doc.keys());
    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  // Calculate IDF for each term
  const idf = new Map<string, number>();
  for (const [term, docFreq] of documentFrequency.entries()) {
    idf.set(term, Math.log(totalDocuments / docFreq));
  }

  return idf;
}

/**
 * Calculate TF-IDF scores for a document
 */
function calculateTFIDF(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
  const tfidf = new Map<string, number>();

  for (const [term, tfScore] of tf.entries()) {
    const idfScore = idf.get(term) || 0;
    tfidf.set(term, tfScore * idfScore);
  }

  return tfidf;
}

/**
 * Calculate vector magnitude for cosine similarity
 */
function calculateMagnitude(vector: Map<string, number>): number {
  let sum = 0;
  for (const value of vector.values()) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

/**
 * Extract term frequencies from content
 */
function extractTermFrequencies(content: string): Map<string, number> {
  const tokens = tokenize(content);
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  return frequencies;
}

/**
 * Build TF-IDF search index from documents
 */
export function buildSearchIndex(
  documents: Array<{ uri: string; content: string }>
): SearchIndex {
  // Extract term frequencies for all documents
  const documentTerms = documents.map((doc) => ({
    uri: doc.uri,
    terms: extractTermFrequencies(doc.content),
  }));

  // Calculate IDF scores
  const idf = calculateIDF(
    documentTerms.map((d) => d.terms),
    documents.length
  );

  // Calculate TF-IDF for each document
  const documentVectors: DocumentVector[] = documentTerms.map((doc) => {
    const tf = calculateTF(doc.terms);
    const tfidf = calculateTFIDF(tf, idf);
    const magnitude = calculateMagnitude(tfidf);

    return {
      uri: doc.uri,
      terms: tfidf,
      rawTerms: doc.terms,
      magnitude,
    };
  });

  return {
    documents: documentVectors,
    idf,
    totalDocuments: documents.length,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

/**
 * Calculate cosine similarity between query and document
 */
export function calculateCosineSimilarity(
  queryVector: Map<string, number>,
  docVector: DocumentVector
): number {
  let dotProduct = 0;

  // Calculate dot product
  for (const [term, queryScore] of queryVector.entries()) {
    const docScore = docVector.terms.get(term) || 0;
    dotProduct += queryScore * docScore;
  }

  // Calculate query magnitude
  const queryMagnitude = calculateMagnitude(queryVector);

  if (queryMagnitude === 0 || docVector.magnitude === 0) {
    return 0;
  }

  return dotProduct / (queryMagnitude * docVector.magnitude);
}

/**
 * Process query into TF-IDF vector
 */
export function processQuery(query: string, idf: Map<string, number>): Map<string, number> {
  const terms = tokenize(query);
  const queryVector = new Map<string, number>();

  for (const term of terms) {
    const idfValue = idf.get(term) || 0;
    if (idfValue > 0) {
      queryVector.set(term, idfValue);
    }
  }

  return queryVector;
}

/**
 * Search documents using TF-IDF and cosine similarity
 */
export function searchDocuments(
  query: string,
  index: SearchIndex,
  options: {
    limit?: number;
    minScore?: number;
  } = {}
): Array<{ uri: string; score: number; matchedTerms: string[] }> {
  const { limit = 10, minScore = 0 } = options;

  // Process query
  const queryVector = processQuery(query, index.idf);
  const queryTokens = tokenize(query);

  // Calculate similarity for each document
  const results = index.documents.map((doc) => {
    let score = calculateCosineSimilarity(queryVector, doc);

    // Boost for exact term matches
    const matchedTerms: string[] = [];
    for (const token of queryTokens) {
      if (doc.rawTerms.has(token)) {
        score *= 1.5; // Boost exact matches
        matchedTerms.push(token);
      }
    }

    // Boost for phrase matches (all terms found)
    if (matchedTerms.length === queryTokens.length && queryTokens.length > 1) {
      score *= 2.0;
    }

    return {
      uri: doc.uri,
      score,
      matchedTerms,
    };
  });

  // Filter and sort
  return results
    .filter((result) => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
