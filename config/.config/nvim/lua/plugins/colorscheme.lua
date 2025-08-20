return {
  {
    "sainnhe/everforest",
    lazy = false,
    priority = 1000,
    config = function()
      vim.g.everforest_background = "soft" -- "soft", "medium", or "hard"
      vim.g.everforest_transparent_background = 0
      vim.cmd.colorscheme("everforest")
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "everforest",
    },
  },
}
