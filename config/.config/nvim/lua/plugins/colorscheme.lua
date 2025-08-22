return {
  {
    "sainnhe/everforest",
    lazy = false,
    priority = 1000,
    init = function()
      -- Set up everforest variants
      vim.g.everforest_background = "soft"
      vim.g.everforest_transparent_background = 0
    end,
    config = function()
      -- Create colorscheme files for each variant
      local config_path = vim.fn.stdpath("config")
      local colors_dir = config_path .. "/colors"
      
      -- Create colors directory if it doesn't exist
      vim.fn.mkdir(colors_dir, "p")
      
      -- Create variant colorscheme files
      local variants = {"soft", "medium", "hard"}
      for _, variant in ipairs(variants) do
        local content = string.format([[
" Everforest %s variant
let g:everforest_background = '%s'
runtime colors/everforest.vim
let g:colors_name = 'everforest-%s'
]], variant, variant, variant)
        
        local file_path = colors_dir .. "/everforest-" .. variant .. ".vim"
        local file = io.open(file_path, "w")
        if file then
          file:write(content)
          file:close()
        end
      end
      
      vim.cmd.colorscheme("everforest")
    end,
  },
  {
    "arcticicestudio/nord-vim",
    lazy = false,
    priority = 1000,
  },
  {
    "shaunsingh/nord.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      -- Nord theme configuration
      vim.g.nord_contrast = true
      vim.g.nord_borders = false
      vim.g.nord_disable_background = false
      vim.g.nord_italic = false
      vim.g.nord_uniform_diff_background = true
      vim.g.nord_bold = false
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "everforest",
    },
  },
}
