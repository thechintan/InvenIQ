const formatResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
});

const formatError = (message, statusCode = 500) => ({
  success: false,
  error: message,
  statusCode,
});

const paginate = (query, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return {
    paginatedQuery: `${query} LIMIT ${limit} OFFSET ${offset}`,
    page: parseInt(page),
    limit: parseInt(limit),
    offset,
  };
};

const validateUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

module.exports = { formatResponse, formatError, paginate, validateUUID };
