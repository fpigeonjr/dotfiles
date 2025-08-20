-- ~/.config/nvim/lua/plugins/mdx.lua
return {
  -- Reuses markdown + tsx, ships the queries & filetype
  { "davidmh/mdx.nvim", config = true, dependencies = { "nvim-treesitter/nvim-treesitter" } },

  -- Make sure the underlying parsers are present
  {
    "nvim-treesitter/nvim-treesitter",
    opts = function(_, opts)
      opts.ensure_installed = opts.ensure_installed or {}
      -- NOTE: no "mdx" here on purpose
      vim.list_extend(opts.ensure_installed, { "markdown", "markdown_inline", "tsx", "javascript" })
    end,
  },

  -- Filetype detection for .mdx -> markdown.mdx
  {
    "nvim-treesitter/nvim-treesitter",
    init = function()
      vim.filetype.add({ extension = { mdx = "markdown.mdx" } })
    end,
  },
}
