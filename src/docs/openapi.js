/**
 * OpenAPI 3 spec for Swagger UI. Server URL is derived from each request (Host / proxy headers)
 * so "Try it out" works locally, behind ngrok, and in production without editing the file.
 */
export function buildOpenApiSpec(req) {
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
  const baseUrl = `${proto}://${host}`;

  return {
    openapi: '3.0.3',
    info: {
      title: 'Automated book generation API',
      version: '1.0.0',
      description:
        'Human-in-the-loop book pipeline: outline → chapters (with summaries) → compile. Requires `SUPABASE_*` and `GEMINI_API_KEY` on the server.',
    },
    servers: [{ url: baseUrl, description: 'This host (from request)' }],
    tags: [
      { name: 'Health' },
      { name: 'Books' },
      { name: 'Chapters' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/books': {
        get: {
          tags: ['Books'],
          summary: 'List books',
          responses: { '200': { description: 'Array of book summaries' } },
        },
        post: {
          tags: ['Books'],
          summary: 'Create book',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title'],
                  properties: {
                    title: { type: 'string' },
                    notes_on_outline_before: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/books/{id}': {
        get: {
          tags: ['Books'],
          summary: 'Get book by id',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          responses: { '200': { description: 'Book' }, '404': { description: 'Not found' } },
        },
        patch: {
          tags: ['Books'],
          summary: 'Update book fields',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    notes_on_outline_before: { type: 'string', nullable: true },
                    notes_on_outline_after: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
      },
      '/api/books/{id}/chapters': {
        get: {
          tags: ['Books'],
          summary: 'List chapters for book',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          responses: { '200': { description: 'Chapter array' } },
        },
      },
      '/api/books/{id}/outline/generate': {
        post: {
          tags: ['Books'],
          summary: 'Generate outline (Gemini)',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          responses: { '200': { description: 'Book with outline' } },
        },
      },
      '/api/books/{id}/outline/review': {
        patch: {
          tags: ['Books'],
          summary: 'Outline review gate',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status_outline_notes: {
                      type: 'string',
                      enum: ['yes', 'no', 'no_notes_needed'],
                    },
                    notes_on_outline_after: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
      },
      '/api/books/{id}/chapters/plan': {
        post: {
          tags: ['Books'],
          summary: 'Plan chapter rows from outline',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          responses: { '201': { description: 'Chapters created' } },
        },
      },
      '/api/books/{id}/chapters/unlock-all': {
        post: {
          tags: ['Books'],
          summary: 'Set chapter_notes_status for pending chapters (demo helper)',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/books/{id}/final-review': {
        patch: {
          tags: ['Books'],
          summary: 'Final review fields before compile',
          parameters: [{ $ref: '#/components/parameters/bookId' }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    final_review_notes_status: {
                      type: 'string',
                      enum: ['yes', 'no', 'no_notes_needed'],
                    },
                    final_review_notes: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
      },
      '/api/books/{id}/compile': {
        post: {
          tags: ['Books'],
          summary: 'Compile book to .txt or .docx',
          parameters: [
            { $ref: '#/components/parameters/bookId' },
            {
              name: 'format',
              in: 'query',
              schema: { type: 'string', enum: ['txt', 'docx', 'both'], default: 'txt' },
            },
          ],
          responses: { '200': { description: 'File or JSON (both)' } },
        },
      },
      '/api/chapters/{id}/notes': {
        patch: {
          tags: ['Chapters'],
          summary: 'Chapter notes / gate',
          parameters: [{ $ref: '#/components/parameters/chapterId' }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    chapter_notes: { type: 'string', nullable: true },
                    chapter_notes_status: {
                      type: 'string',
                      enum: ['yes', 'no', 'no_notes_needed'],
                    },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
      },
      '/api/chapters/{id}/generate': {
        post: {
          tags: ['Chapters'],
          summary: 'Generate chapter body + summary',
          parameters: [{ $ref: '#/components/parameters/chapterId' }],
          responses: { '200': { description: 'Chapter updated' } },
        },
      },
    },
    components: {
      parameters: {
        bookId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        chapterId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      },
    },
  };
}
