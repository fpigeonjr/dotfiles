return {
  { "neovim/nvim-lspconfig", opts = { servers = { marksman = {} } } },
  { "williamboman/mason.nvim", opts = { ensure_installed = { "marksman" } } },
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        markdown = { "prettier" },
      },
    },
  },
  { "ellisonleao/glow.nvim", cmd = "Glow", config = true }, -- or use markdown-preview.nvim
}
